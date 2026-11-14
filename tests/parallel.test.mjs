import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';
import { acquireWorkflowSlot, resolveWorkerCount, runQueued } from '../dist/workflows/parallel.js';

// Confirms worker-count overrides keep their documented precedence and validation.
test('worker count resolves CLI, domain, environment, and fallback values', () => {
	assert.equal(resolveWorkerCount(3, 'courses', { argv: ['node', 'script', '--workers=2'], env: { PW_COURSES_WORKERS: '4' } }), 2);
	assert.equal(resolveWorkerCount(3, 'courses', { argv: ['node', 'script', '--workers', '5'], env: { PW_COURSES_WORKERS: '4' } }), 5);
	assert.equal(resolveWorkerCount(3, 'courses', { argv: ['node', 'script'], env: { PW_COURSES_WORKERS: '4', PW_WORKERS: '6' } }), 4);
	assert.equal(resolveWorkerCount(3, undefined, { argv: ['node', 'script'], env: { PW_WORKERS: '0' } }), 3);
	assert.equal(resolveWorkerCount(0, undefined, { argv: ['node', 'script'], env: {} }), 1);
});
// Verifies queue workers respect their limit and return failures in input order.
test('queued work stays bounded and sorts worker failures by input index', async () => {
	let aWorkers = 0;
	let maximumWorkers = 0;
	const completed = [];
	// terra-quality-ignore single-use -- Await the queue before asserting its observed concurrency and completion order.
	const failures = await runQueued([0, 1, 2, 3], 2, async (item, index) => {
		aWorkers++;
		maximumWorkers = Math.max(maximumWorkers, aWorkers);
		try {
			await delay(item === 1 ? 15 : 2);
			if (item > 0) throw new Error(`item-${item}`);
			completed.push(index);
		} finally {
			aWorkers--;
		}
	});
	assert.equal(maximumWorkers, 2);
	assert.deepEqual(completed, [0]);
	assert.deepEqual(
		failures.map(f => f.index),
		[1, 2, 3],
	);
});
// Confirms a workflow slot can be cancelled while occupied and released more than once.
test('workflow slots release idempotently and honor cancellation', async () => {
	const dir = await mkdtemp(path.join(os.tmpdir(), 'terra-workflow-slot-'));
	try {
		const release = await acquireWorkflowSlot({ name: 'parallel-test', size: 1, directory: dir, pollMs: 1 });
		const controller = new globalThis.AbortController();
		controller.abort(new Error('cancelled'));
		await assert.rejects(acquireWorkflowSlot({ name: 'parallel-test', size: 1, directory: dir, signal: controller.signal }), /cancelled/u);
		await release();
		await release();
		await (
			await acquireWorkflowSlot({ name: 'parallel-test', size: 1, directory: dir, pollMs: 1 })
		)();
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test('workflow slots serialize acquisitions across processes', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'terra-workflow-process-lock-'));
	// terra-quality-ignore single-use -- Both child workers receive the same lock directory captured before launch.
	const lockDir = path.join(root, 'locks');
	const eventPath = path.join(root, 'events.txt');
	// terra-quality-ignore single-use -- Both child processes execute the same precomputed fixture source.
	const source = `
		import { appendFile } from 'node:fs/promises';
		import { setTimeout as delay } from 'node:timers/promises';
		import { acquireWorkflowSlot } from ${JSON.stringify(new URL('../dist/workflows/parallel.js', import.meta.url).href)};
		const [lockDir, eventPath, workerId] = process.argv.slice(1);
		const release = await acquireWorkflowSlot({ name: 'parallel-test', size: 1, directory: lockDir, pollMs: 2 });
		try {
			await appendFile(eventPath, '+' + workerId + '\\n');
			await delay(30);
			await appendFile(eventPath, '-' + workerId + '\\n');
		} finally {
			await release();
		}
	`;
	/** Starts a child process that acquires the shared workflow slot.
	 * @param id Label written to the process event log.
	 * @returns A promise that settles when the child process exits successfully.
	 */
	const runWorker = id =>
		new Promise((resolve, reject) => {
			const worker = spawn(process.execPath, ['--input-type=module', '--eval', source, lockDir, eventPath, id], { stdio: 'ignore' });
			worker.once('error', reject);
			worker.once('exit', (code, signal) => {
				if (code === 0) resolve(undefined);
				else reject(new Error(`Workflow lock worker exited with code ${code} and signal ${signal}.`));
			});
		});
	try {
		await Promise.all([runWorker('first'), runWorker('second')]);
		const a = new Set();
		for (const event of (await readFile(eventPath, 'utf8')).trim().split('\n')) {
			const [op, id] = [event[0], event.slice(1)];
			if (op === '+') {
				assert.equal(a.size, 0, 'a second process entered while the workflow slot was occupied');
				a.add(id);
			} else {
				assert.equal(a.delete(id), true, 'a process released a slot it did not own');
			}
		}
		assert.equal(a.size, 0);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
