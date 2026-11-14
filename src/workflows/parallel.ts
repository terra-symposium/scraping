/**
 * src/workflows/parallel.ts
 */

/*//////////////////////////////////////////////////
IMPORTS
//////////////////////////////////////////////////*/

// API
import os from 'node:os';
import path from 'node:path';
import { chmod, mkdir, open, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

/*//////////////////////////////////////////////////
CONFIG
//////////////////////////////////////////////////*/

/** One failed item from a bounded workflow queue. */
export type QueueFailure<T> = {
	/** Index of the failed input item. */
	index: number;
	/** Input value that failed. */
	item: T;
	/** Original value thrown by the worker. */
	error: unknown;
};
/** Optional inputs for deterministic worker-count resolution. */
export type ResolveWorkerCountOptions = {
	/** CLI arguments to inspect; defaults to the current process arguments. */
	argv?: readonly string[];
	/** Environment values to inspect; defaults to the current process environment. */
	env?: NodeJS.ProcessEnv;
};
/** Options for acquiring a cross-process workflow slot. */
export type WorkflowSlotOptions = {
	/** Pool identifier, used to keep independent workflows separate. */
	name: string;
	/** Maximum number of simultaneous slots. */
	size: number;
	/** Optional lock directory; the default is scoped to this repository in the OS temp folder. */
	directory?: string;
	/** Time between lock attempts in milliseconds. Defaults to 250. */
	pollMs?: number;
	/** Optional signal that cancels a waiting acquisition. */
	signal?: AbortSignal;
};

/*//////////////////////////////////////////////////
HELPERS
//////////////////////////////////////////////////*/

/**
 * Parses a positive integer override without accepting empty, fractional, or unsafe values.
 *
 * @param value Raw command-line or environment value.
 *
 * @return Parsed positive integer, or `undefined` when the value is invalid.
 */
function positiveInt(value: string | undefined): number | undefined {
	if (!value || !/^\d+$/.test(value)) return undefined;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Resolves a positive worker limit from CLI flags and environment overrides.
 *
 * Precedence is `--workers`, `PW_<DOMAIN>_WORKERS`, `PW_HEADED_WORKERS` in headed
 * mode, `PW_WORKERS`, then the supplied fallback.
 *
 * @param fallback - Worker count used when no override is valid.
 * @param domain - Optional name for a domain-specific environment override.
 * @param options - Optional argument and environment sources.
 *
 * @return The selected worker count.
 */
export function resolveWorkerCount(fallback = 5, domain?: string, options: ResolveWorkerCountOptions = {}): number {
	const argv = options.argv || process.argv;
	const env = options.env || process.env;
	let flagIndex = -1;
	let inlineWorkerValue: string | undefined;
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (flagIndex < 0 && argument === '--workers') flagIndex = index;
		if (inlineWorkerValue === undefined && argument.startsWith('--workers=')) inlineWorkerValue = argument.slice('--workers='.length);
	}
	return (
		positiveInt(inlineWorkerValue) ||
		positiveInt(flagIndex >= 0 ? argv[flagIndex + 1] : undefined) ||
		(domain ? positiveInt(env[`PW_${domain.toUpperCase()}_WORKERS`]) : undefined) ||
		(argv.includes('--headed') ? positiveInt(env.PW_HEADED_WORKERS) : undefined) ||
		positiveInt(env.PW_WORKERS) ||
		positiveInt(String(fallback)) ||
		1
	);
}

/**
 * Runs input items with bounded concurrency and records failures in input order.
 *
 * @param items - Input values to process.
 * @param workerCount - Maximum number of simultaneous workers.
 * @param execute - Operation run for each item and its input index.
 *
 * @return Failures sorted by their original input index.
 */
export async function runQueued<T>(items: readonly T[], workerCount: number, execute: (item: T, index: number) => Promise<void>): Promise<QueueFailure<T>[]> {
	const failures: QueueFailure<T>[] = [];
	const state = { cursor: 0, failures };
	const workerLimit = Math.min(items.length, Number.isFinite(workerCount) ? Math.max(1, Math.floor(workerCount)) : 1);
	const workers: Promise<void>[] = [];
	for (let workerIndex = 0; workerIndex < workerLimit; workerIndex++) workers.push(drainQueue(items, execute, state));
	await Promise.all(workers);
	return failures.sort(compFailureIndex);
}

/**
 * Processes queue items claimed from a shared cursor until no work remains.
 *
 * @param items Values to process in original order.
 * @param execute Operation run for each item and its input index.
 * @param state Shared cursor and failure collection for concurrent workers.
 */
async function drainQueue<T>(items: readonly T[], execute: (item: T, index: number) => Promise<void>, state: { cursor: number; failures: QueueFailure<T>[] }): Promise<void> {
	while (state.cursor < items.length) {
		const index = state.cursor++;
		try {
			await execute(items[index], index);
		} catch (err) {
			state.failures.push({ error: err, index, item: items[index] });
		}
	}
}

/**
 * Orders queue failures by the input position that produced them.
 *
 * @param l First failure to compare.
 * @param r Second failure to compare.
 *
 * @return Negative, zero, or positive order result for `Array.sort`.
 */
function compFailureIndex<T>(l: QueueFailure<T>, r: QueueFailure<T>): number {
	return l.index - r.index;
}

/**
 * Waits for an available cross-process slot and returns its release callback.
 *
 * @param options - Pool name, size, lock location, and optional cancellation signal.
 *
 * @return A callback that releases the acquired slot.
 */
export async function acquireWorkflowSlot(options: WorkflowSlotOptions): Promise<() => Promise<void>> {
	if (!Number.isSafeInteger(options.size) || options.size < 1) throw new Error('Workflow slot size must be a positive integer.');
	const dir = path.resolve(
		options.directory ||
			path.join(
				os.tmpdir(),
				'terra-symposium-workflow-pools',
				createHash('sha256').update(path.resolve(process.cwd())).digest('hex').slice(0, 12),
				options.name
					.toLowerCase()
					.replace(/[^a-z0-9_-]+/g, '-')
					.replace(/^-+|-+$/g, '') || 'workflow',
			),
	);
	await mkdir(dir, { recursive: true, mode: 0o700 });
	try {
		await chmod(dir, 0o700);
	} catch {
		// The lock directory remains usable when the platform does not support chmod.
	}
	while (true) {
		if (options.signal?.aborted) throw options.signal.reason || new Error('Workflow slot acquisition was aborted.');
		for (let index = 0; index < options.size; index++) {
			const filePath = path.join(dir, `${index}.lock`);
			try {
				const handle = await open(filePath, 'wx', 0o600);
				await handle.writeFile(`${process.pid}\n`);
				await handle.close();
				let released = false;
				// Release the lock file at most once.
				return async (): Promise<void> => {
					if (released) return;
					released = true;
					await rm(filePath, { force: true });
				};
			} catch (cause) {
				if (typeof cause !== 'object' || !cause || !('code' in cause) || cause.code !== 'EEXIST') throw cause;
				let lockContents = '';
				try {
					lockContents = await readFile(filePath, 'utf8');
				} catch {
					// The competing process may have released the lock between open and read.
				}
				const pid = Number(lockContents.trim());
				if (!Number.isSafeInteger(pid) || pid <= 0) await rm(filePath, { force: true });
				else {
					try {
						process.kill(pid, 0);
					} catch (lockErr) {
						if ((typeof lockErr === 'object' && lockErr && 'code' in lockErr ? String(lockErr.code) : '') !== 'EPERM') await rm(filePath, { force: true });
					}
				}
			}
		}
		try {
			await delay(Number.isFinite(options.pollMs) && (options.pollMs || 0) > 0 ? Math.floor(options.pollMs as number) : 250, undefined, { signal: options.signal });
		} catch (cause) {
			if (options.signal?.aborted) throw options.signal.reason || new Error('Workflow slot acquisition was aborted.');
			throw cause;
		}
	}
}
