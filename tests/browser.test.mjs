import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { chromium } from 'playwright';
import { authenticateWorkflow } from '../dist/workflows/browser.js';

test('interactive authentication saves state and returns in the requested browser mode', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'terra-browser-auth-'));
	const storageStatePath = path.join(root, 'private', 'storage-state.json');
	const headedModes = [];
	const closedModes = [];
	let interactiveStarts = 0;
	try {
		const session = await authenticateWorkflow({
			sessionName: 'test-workflow',
			storageStatePath,
			interactive: true,
			timeoutMs: 100,
			createSession: async ({ headed }) => {
				headedModes.push(headed);
				return {
					browser: {},
					context: {
						authenticated:
							headed ||
							(await access(storageStatePath).then(
								() => true,
								() => false,
							)),
						/**
						 * Writes the simulated browser's authentication state to the requested file.
						 *
						 * @param target - Destination file requested by the workflow.
						 */
						async storageState({ path: target }) {
							await mkdir(path.dirname(target), { recursive: true });
							await writeFile(target, JSON.stringify({ cookies: [], origins: [] }));
						},
					},
					close: async () => closedModes.push(headed),
				};
			},
			open: async context => context,
			isReady: async context => context.authenticated,
			onInteractiveStart: () => {
				interactiveStarts++;
			},
		});

		assert.deepEqual(headedModes, [false, true, false]);
		assert.deepEqual(closedModes, [false, true]);
		assert.equal(interactiveStarts, 1);
		assert.equal(session.storageStatePath, storageStatePath);
		assert.deepEqual(JSON.parse(await readFile(storageStatePath, 'utf8')), { cookies: [], origins: [] });
		if (process.platform !== 'win32') {
			assert.equal((await stat(path.dirname(storageStatePath))).mode & 0o777, 0o700);
			assert.equal((await stat(storageStatePath)).mode & 0o777, 0o600);
		}
		await session.close();
		assert.deepEqual(closedModes, [false, true, false]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('non-interactive authentication rejects invalid state and closes its session', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'terra-browser-auth-required-'));
	let closed = 0;
	let storageSaved = false;
	try {
		await assert.rejects(
			authenticateWorkflow({
				sessionName: 'test-workflow',
				storageStatePath: path.join(root, 'storage-state.json'),
				authenticationRequiredMessage: 'Sign-in is required.',
				createSession: async () => ({ browser: {}, context: { storageState: async () => (storageSaved = true) }, close: async () => closed++ }),
				open: async context => context,
				isReady: async () => false,
			}),
			/Sign-in is required\./u,
		);
		assert.equal(closed, 1);
		assert.equal(storageSaved, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('authentication closes a created session when opening the workflow fails', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'terra-browser-auth-open-failure-'));
	const openingErr = new Error('Could not open the workflow page.');
	let closed = 0;
	try {
		await assert.rejects(
			authenticateWorkflow({
				sessionName: 'test-workflow',
				storageStatePath: path.join(root, 'storage-state.json'),
				createSession: async () => ({ browser: {}, context: {}, close: async () => closed++ }),
				open: async () => {
					throw openingErr;
				},
				isReady: async () => true,
			}),
			error => error === openingErr,
		);
		assert.equal(closed, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('default authentication loads saved state, saves private state, and closes Chromium once', async t => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'terra-browser-default-'));
	const storageStatePath = path.join(root, 'private', 'state.json');
	await mkdir(path.dirname(storageStatePath), { recursive: true });
	await writeFile(storageStatePath, JSON.stringify({ cookies: [], origins: [] }));
	let launchOptions;
	let contextOptions;
	let contextCloseCount = 0;
	let browserCloseCount = 0;
	let storageStateWrites = 0;
	const context = {
		storageState: async ({ path: target }) => {
			storageStateWrites++;
			await writeFile(target, JSON.stringify({ cookies: [], origins: [] }));
		},
		close: async () => contextCloseCount++,
	};
	// terra-quality-ignore single-use -- The mock returns one captured browser object whose close count is observed after authentication.
	const browser = {
		newContext: async options => {
			contextOptions = options;
			return context;
		},
		close: async () => browserCloseCount++,
	};
	t.mock.method(chromium, 'launch', async options => {
		launchOptions = options;
		return browser;
	});
	try {
		const session = await authenticateWorkflow({
			sessionName: 'default-browser-test',
			storageStatePath,
			open: async openedContext => openedContext,
			isReady: async openedContext => openedContext === context,
		});

		assert.deepEqual(launchOptions, { headless: true });
		assert.deepEqual(contextOptions, { acceptDownloads: true, storageState: storageStatePath });
		assert.equal(session.context, context);
		assert.equal(session.storageStatePath, storageStatePath);
		assert.equal(storageStateWrites, 1);
		if (process.platform !== 'win32') {
			assert.equal((await stat(path.dirname(storageStatePath))).mode & 0o777, 0o700);
			assert.equal((await stat(storageStatePath)).mode & 0o777, 0o600);
		}
		await session.close();
		await session.close();
		assert.equal(contextCloseCount, 1);
		assert.equal(browserCloseCount, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
