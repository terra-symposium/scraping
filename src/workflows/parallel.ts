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
	const flagIndex = argv.findIndex((argument) => argument === '--workers');
	return (
		positiveInt(argv.find((argument) => argument.startsWith('--workers='))?.slice('--workers='.length)) ||
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
	let cursor = 0;
	await Promise.all(
		Array.from({ length: Math.min(items.length, Number.isFinite(workerCount) ? Math.max(1, Math.floor(workerCount)) : 1) }, async () => {
			while (cursor < items.length) {
				const index = cursor++;
				try {
					await execute(items[index], index);
				} catch (err) {
					failures.push({ error: err, index, item: items[index] });
				}
			}
		}),
	);
	return failures.sort((left, right) => left.index - right.index);
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
	await chmod(dir, 0o700).catch(() => undefined);
	while (true) {
		if (options.signal?.aborted) throw options.signal.reason || new Error('Workflow slot acquisition was aborted.');
		for (let index = 0; index < options.size; index++) {
			const filePath = path.join(dir, `${index}.lock`);
			try {
				const handle = await open(filePath, 'wx', 0o600);
				await handle.writeFile(`${process.pid}\n`);
				await handle.close();
				let released = false;
				return async () => {
					if (released) return;
					released = true;
					await rm(filePath, { force: true });
				};
			} catch (cause) {
				if (typeof cause !== 'object' || !cause || !('code' in cause) || cause.code !== 'EEXIST') throw cause;
				const pid = Number((await readFile(filePath, 'utf8').catch(() => '')).trim());
				if (!Number.isSafeInteger(pid) || pid <= 0) {
					await rm(filePath, { force: true });
				} else {
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
