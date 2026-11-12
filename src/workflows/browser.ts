/**
 * src/workflows/browser.ts
 */

/*//////////////////////////////////////////////////
IMPORTS
//////////////////////////////////////////////////*/

// API
import os from 'node:os';
import path from 'node:path';
import { access, chmod, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// TYPES
import type { Browser, BrowserContext } from 'playwright';

/*//////////////////////////////////////////////////
CONFIG
//////////////////////////////////////////////////*/

/** Options for launching a workflow browser session. */
export type WorkflowBrowserOptions = {
	/** Whether to show the Chromium window. Defaults to false. */
	headed?: boolean;
	/** Optional Playwright storage-state file to load. */
	storageStatePath?: string;
	/** Optional persistent Chromium profile directory. */
	userDataDir?: string;
	/** Optional browser channel, such as `chrome`. */
	channel?: string;
	/** Optional Chromium executable path. */
	executablePath?: string;
	/** Additional Chromium command-line arguments. */
	args?: string[];
	/** Whether download events are accepted. Defaults to true. */
	acceptDownloads?: boolean;
};
/** Browser resources owned by one workflow run. */
export type WorkflowBrowserSession = {
	/** Chromium browser process. */
	browser: Browser;
	/** Isolated Playwright browser context. */
	context: BrowserContext;
	/** Closes this browser context and its owned process once. */
	close: () => Promise<void>;
};
/** Callback options for a consumer-provided browser session factory. */
export type WorkflowSessionFactoryOptions = {
	/** Whether the created browser window should be visible. */
	headed: boolean;
	/** The storage-state path used by the workflow. */
	storageStatePath: string;
};
/** Options for a workflow that validates and reuses authenticated browser state. */
export type AuthenticateWorkflowOptions<T> = {
	/** Stable application name used to choose the default state-file path. */
	sessionName: string;
	/** Optional explicit Playwright storage-state path. */
	storageStatePath?: string;
	/** Whether the returned browser should remain visible. Defaults to false. */
	headed?: boolean;
	/** Whether a visible sign-in session may be opened when saved state is invalid. */
	interactive?: boolean;
	/** Maximum time allowed for an interactive sign-in, in milliseconds. */
	timeoutMs?: number;
	/** Optional callback that creates a browser session with app-specific settings. */
	createSession?: (options: WorkflowSessionFactoryOptions) => Promise<WorkflowBrowserSession>;
	/** Opens the workflow's pages or other state in a browser context. */
	open: (context: BrowserContext) => Promise<T>;
	/** Returns true after the app-specific authenticated state is ready. */
	isReady: (value: T) => Promise<boolean>;
	/** Optional callback for a failed saved-state or post-login check. */
	captureFailure?: (value: T, reason: string) => Promise<void>;
	/** Optional callback called when the user must finish sign-in in a visible browser. */
	onInteractiveStart?: () => void | Promise<void>;
	/** Error message for a non-interactive run with invalid saved state. */
	authenticationRequiredMessage?: string;
};
/** A workflow session with app-specific pages or state attached. */
export type AuthenticatedWorkflowSession<T> = WorkflowBrowserSession & {
	/** The pages or value opened by the workflow. */
	value: T;
	/** The absolute Playwright storage-state path. */
	storageStatePath: string;
};

/** Resolves cleanup failures to `undefined` so best-effort resource cleanup can continue.
 *
 * @return `undefined` so the original workflow result or error remains authoritative.
 */
function ignoreCleanupFailure(): undefined {
	return undefined;
}

/** Checks whether a saved Playwright state file is accessible without treating absence as fatal.
 *
 * @param storageStatePath Absolute path to the state file to check.
 *
 * @return Whether the file can be accessed.
 */
async function storageStateExists(storageStatePath: string): Promise<boolean> {
	try {
		await access(storageStatePath);
		return true;
	} catch {
		return false;
	}
}

/** Launches the default Chromium session for an authentication workflow.
 *
 * @param options Visibility and storage-state settings forwarded from the workflow.
 *
 * @return A Chromium session owned by the workflow.
 */
function createDefaultWorkflowSession(options: WorkflowSessionFactoryOptions): Promise<WorkflowBrowserSession> {
	return launchWorkflowSession({ headed: options.headed, storageStatePath: options.storageStatePath });
}

/*//////////////////////////////////////////////////
HELPERS
//////////////////////////////////////////////////*/

/**
 * Resolves an OS-level state-file path for a named workflow.
 *
 * @param sessionName - Stable name that separates this workflow's browser state.
 *
 * @return Absolute path outside the current repository.
 */
export function resolveWorkflowStorageStatePath(sessionName: string): string {
	return path.join(
		process.platform === 'darwin'
			? path.join(os.homedir(), 'Library', 'Application Support', 'Terra Symposium', 'Workflows')
			: path.join(os.homedir(), '.config', 'terra-symposium', 'workflows'),
		sessionName
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'workflow',
		'storage-state.json',
	);
}

/**
 * Launches Chromium in a headed or headless mode and loads saved state when present.
 *
 * @param options - Browser visibility, state-file, and launch settings.
 *
 * @return Browser and context resources owned by the caller.
 */
export async function launchWorkflowSession(options: WorkflowBrowserOptions = {}): Promise<WorkflowBrowserSession> {
	const statePath = options.storageStatePath ? path.resolve(options.storageStatePath) : undefined;
	const launchOptions = {
		headless: !(options.headed ?? false),
		...(options.channel ? { channel: options.channel } : {}),
		...(options.executablePath ? { executablePath: options.executablePath } : {}),
		...(options.args?.length ? { args: options.args } : {}),
	};
	const contextOptions = { acceptDownloads: options.acceptDownloads ?? true, ...(statePath && (await storageStateExists(statePath)) ? { storageState: statePath } : {}) };
	if (options.userDataDir) {
		const context = await chromium.launchPersistentContext(path.resolve(options.userDataDir), { ...launchOptions, ...contextOptions });
		const browser = context.browser();
		if (!browser) {
			await context.close().catch(ignoreCleanupFailure);
			throw new Error('Persistent Chromium context did not expose a Browser handle.');
		}
		let closed = false;
		/** Closes the persistent context and its browser process only once. */
		async function closePersistentContext(): Promise<void> {
			if (closed) return;
			closed = true;
			await context.close().catch(ignoreCleanupFailure);
		}
		return { browser, context, close: closePersistentContext };
	}
	const browser = await chromium.launch(launchOptions);
	try {
		const context = await browser.newContext(contextOptions);
		let closed = false;
		/** Closes both resources owned by this nonpersistent workflow session once. */
		async function closeWorkflowBrowser(): Promise<void> {
			if (closed) return;
			closed = true;
			await context.close().catch(ignoreCleanupFailure);
			await browser.close().catch(ignoreCleanupFailure);
		}
		return { browser, context, close: closeWorkflowBrowser };
	} catch (cause) {
		await browser.close().catch(ignoreCleanupFailure);
		throw cause;
	}
}

/**
 * Closes an owned workflow browser session.
 *
 * @param session - Browser and context resources to release.
 *
 * @return A promise that resolves after the resources are closed.
 */
export async function closeWorkflowSession(session: Pick<WorkflowBrowserSession, 'browser' | 'context'> & { close?: () => Promise<void> }): Promise<void> {
	if (session.close) {
		await session.close();
		return;
	}
	await session.context.close().catch(ignoreCleanupFailure);
	await session.browser.close().catch(ignoreCleanupFailure);
}

/**
 * Runs a callback with a browser session and guarantees cleanup.
 *
 * @param options - Browser visibility, state-file, and launch settings.
 * @param run - Operation that uses the created browser resources.
 *
 * @return The value returned by the operation.
 */
export async function withWorkflowSession<T>(options: WorkflowBrowserOptions, run: (session: WorkflowBrowserSession) => Promise<T>): Promise<T> {
	const session = await launchWorkflowSession(options);
	try {
		return await run(session);
	} finally {
		await session.close();
	}
}

/** Persists browser login state with private permissions on its directory and file.
 *
 * @param context Browser context whose authenticated state is saved.
 * @param storageStatePath Absolute destination for the Playwright state file.
 */
async function saveStorageState(context: BrowserContext, storageStatePath: string): Promise<void> {
	const dir = path.dirname(storageStatePath);
	await mkdir(dir, { recursive: true, mode: 0o700 });
	await chmod(dir, 0o700).catch(ignoreCleanupFailure);
	await context.storageState({ path: storageStatePath });
	await chmod(storageStatePath, 0o600).catch(ignoreCleanupFailure);
}

/**
 * Reuses authenticated state and optionally opens a visible session for manual sign-in.
 *
 * @param options - Browser setup, page-opening, and readiness callbacks.
 *
 * @return An authenticated session with the workflow's pages or state.
 */
export async function authenticateWorkflow<T>(options: AuthenticateWorkflowOptions<T>): Promise<AuthenticatedWorkflowSession<T>> {
	const storageStatePath = path.resolve(options.storageStatePath || resolveWorkflowStorageStatePath(options.sessionName));
	const requestedHeaded = options.headed ?? false;
	const timeoutMs = options.timeoutMs || 15 * 60_000;
	let session: WorkflowBrowserSession | undefined;
	let value!: T;

	const createSession = options.createSession ?? createDefaultWorkflowSession;
	/** Opens the consumer's app state in a new browser session using the selected headed mode.
	 * @param headed Whether Chromium should open visibly.
	 */
	async function open(headed: boolean): Promise<void> {
		session = await createSession({ headed, storageStatePath });
		value = await options.open(session.context);
	}

	/** Captures the current app state when a saved or newly signed-in session fails validation.
	 * @param reason Explanation for the failed readiness check.
	 */
	async function captureFailure(reason: string): Promise<void> {
		if (options.captureFailure) await options.captureFailure(value, reason);
	}

	/** Checks whether the current app-specific value represents an authenticated session.
	 * @returns Whether the app-specific value is ready.
	 */
	async function ready(): Promise<boolean> {
		return options.isReady(value);
	}
	try {
		await open(requestedHeaded);
		if (await ready()) {
			await saveStorageState(session!.context, storageStatePath);
			return { ...session!, value, storageStatePath };
		}
		await captureFailure("Saved browser state did not pass this workflow's readiness check.");
		if (!options.interactive) throw new Error(options.authenticationRequiredMessage || 'Authentication is required. Enable interactive sign-in to continue.');
		if (!requestedHeaded) {
			await session!.close();
			session = undefined;
			await open(true);
		}
		await options.onInteractiveStart?.();
		const deadline = Date.now() + timeoutMs;
		while (!(await ready())) {
			if (Date.now() >= deadline) throw new Error(`Interactive authentication timed out after ${Math.ceil(timeoutMs / 60_000)} minutes.`);
			/** Waits for the next bounded readiness poll of the interactive browser.
			 * @param resolve Completes the readiness-poll delay.
			 */
			function waitForInteractivePoll(resolve: () => void): void {
				setTimeout(resolve, Math.min(1_000, deadline - Date.now()));
			}
			await new Promise<void>(waitForInteractivePoll);
		}
		await saveStorageState(session!.context, storageStatePath);
		if (!requestedHeaded) {
			await session!.close();
			session = undefined;
			await open(false);
			if (!(await ready())) {
				await captureFailure('The signed-in state could not be reused in the requested browser mode.');
				throw new Error('Sign-in completed, but the saved browser state could not be verified in the requested mode.');
			}
		}
		return { ...session!, value, storageStatePath };
	} catch (cause) {
		await session?.close();
		throw cause;
	}
}
