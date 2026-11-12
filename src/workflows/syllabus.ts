/**
 * src/workflows/syllabus.ts
 */

/*//////////////////////////////////////////////////
IMPORTS
//////////////////////////////////////////////////*/

// API
import os from 'node:os';
import path from 'node:path';
import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { authenticateWorkflow, resolveWorkflowStorageStatePath } from './browser.js';
import { safeCanvasUrl } from '../canvas.js';

// COMPONENTS
import AdmZip from 'adm-zip';

// TYPES
import type { Page } from 'playwright';
import type { WorkflowBrowserSession, WorkflowSessionFactoryOptions } from './browser.js';

/*//////////////////////////////////////////////////
REGEX
//////////////////////////////////////////////////*/

const DOCX_I_REGEX = /^\.docx?$/i;

/** Australian state or territory supported by the syllabus acquisition workflow. */
export type AustralianSyllabusState = 'ACT' | 'NSW' | 'NT' | 'QLD' | 'SA' | 'TAS' | 'VIC' | 'WA';

/** Public curriculum page and default syllabus selection for one Australian jurisdiction. */
export type AustralianSyllabusSource = {
	/** Public source page opened by the browser workflow. */
	url: string;
	/** Default syllabus label selected on sites that expose a custom picker. */
	syllabusName?: string;
};

/** Public curriculum source pages for Australian states and territories. */
export const AUSTRALIAN_SYLLABUS_SOURCES: Record<AustralianSyllabusState, AustralianSyllabusSource> = {
	ACT: { url: 'https://www.act.gov.au/education-and-training/teaching-and-assessment/what-we-teach-curriculum#High-school-years-7-to-10-' },
	NSW: { url: 'https://curriculum.nsw.edu.au/custom', syllabusName: 'English K–10 (2022)' },
	NT: { url: 'https://education.nt.gov.au/policies/curriculum' },
	QLD: { url: 'https://www.qcaa.qld.edu.au/p-10/aciq/version-8/p-10-resources-search' },
	SA: { url: 'https://www.education.sa.gov.au/students/curriculum-and-learning/curriculum-birth-year-10#schooling-%E2%80%93-reception-to-year-10' },
	TAS: { url: 'https://www.decyp.tas.gov.au/learning/primary-school-to-year-12/curriculum/' },
	VIC: { url: 'https://www.vcaa.vic.edu.au/curriculum/foundation-10/curriculum-area-resources/curriculum-area-resources-0' },
	WA: { url: 'https://k10outline.scsa.wa.edu.au/home/teaching/curriculum-browser' },
};

/** Options for preparing a jurisdiction's curriculum page. */
export type PrepareAustralianSyllabusPageOptions = {
	/** Syllabus label to select on the NSW custom syllabus page. */
	syllabusName?: string;
};

/** Options for downloading a syllabus file through its public curriculum page. */
export type FetchAustralianSyllabusOptions = PrepareAustralianSyllabusPageOptions & {
	/** Jurisdiction whose curriculum page and default selection should be used. */
	state: AustralianSyllabusState;
	/** Directory where the downloaded file is saved. */
	outputDirectory?: string;
	/** Optional filename override for the saved download. */
	fileName?: string;
	/** Whether the browser window should remain visible after the workflow returns. */
	headed?: boolean;
	/** Whether a visible browser may be opened for a manual sign-in. */
	interactive?: boolean;
	/** Optional Playwright storage-state file for a source that requires sign-in. */
	storageStatePath?: string;
	/** Maximum time allowed for sign-in or the download control, in milliseconds. */
	timeoutMs?: number;
	/** Optional callback shown when manual sign-in is needed. */
	onInteractiveStart?: () => void | Promise<void>;
	/** Optional factory for consumer-specific browser sessions. */
	createSession?: (options: WorkflowSessionFactoryOptions) => Promise<WorkflowBrowserSession>;
};

/** Metadata for a locally saved syllabus download. */
export type FetchedAustralianSyllabus = {
	/** Jurisdiction used to select the curriculum page. */
	state: AustralianSyllabusState;
	/** Safe source page URL without credentials, query, or fragment. */
	sourceUrl: string;
	/** Absolute path to the downloaded file. */
	filePath: string;
	/** Saved filename. */
	fileName: string;
	/** Time when the download was completed. */
	capturedAt: string;
};

/** Options for normalizing a local syllabus document or archive. */
export type NormalizeSyllabusDocumentOptions = {
	/** Directory that receives the normalized file. */
	outputDirectory?: string;
	/** Optional filename override for a direct document. */
	fileName?: string;
};

/** Result from copying a syllabus document or extracting one document from an archive. */
export type NormalizedSyllabusDocument = {
	/** Absolute path to the resulting Word document. */
	filePath: string;
	/** Filename of the resulting document. */
	fileName: string;
	/** Absolute path to the input document or archive. */
	sourcePath: string;
	/** Archive entry name when a Word document was extracted from a ZIP file. */
	archiveEntry?: string;
};

/**
 * Opens and prepares the public curriculum page for a state or territory.
 *
 * NSW uses a custom picker. The other jurisdictions currently expose their
 * default Word download control directly on the listed curriculum page.
 *
 * @param page - Playwright page to navigate and prepare.
 * @param state - Australian jurisdiction whose curriculum page should be opened.
 * @param options - Optional NSW syllabus selection.
 *
 * @return The prepared Playwright page.
 */
export async function prepareAustralianSyllabusPage(page: Page, state: AustralianSyllabusState, options: PrepareAustralianSyllabusPageOptions = {}): Promise<Page> {
	const source = AUSTRALIAN_SYLLABUS_SOURCES[state];
	if (!source) throw new Error(`No curriculum source is configured for ${state}.`);
	let current: URL | undefined;
	try {
		current = new URL(page.url());
	} catch {
		current = undefined;
	}
	const target = new URL(source.url);
	if (!current || current.origin !== target.origin || current.pathname !== target.pathname) await page.goto(source.url, { waitUntil: 'domcontentloaded' });
	if (state !== 'NSW') return page;
	const syllabusName = options.syllabusName || source.syllabusName || '';
	if (!syllabusName) throw new Error('The NSW curriculum workflow requires a syllabus selection.');
	await page.locator('.custom-view__syllabus-container #search').fill(syllabusName);
	await page.locator('.custom-view__syllabus-container label').filter({ hasText: syllabusName }).first().click();
	const root = page.locator('.tree-picker-id-primary-group, .tree-picker-id-secondary-group');
	await root.locator('input[type="checkbox"]:not(:disabled)').first().waitFor({ timeout: 15_000 });
	const checkboxes = root.locator('input[type="checkbox"]');
	for (let index = 0, count = await checkboxes.count(); index < count; index++) {
		const checkbox = checkboxes.nth(index);
		if (!(await checkbox.isDisabled()) && !(await checkbox.isChecked())) await checkbox.click({ force: true });
	}
	await page.locator('.tree-picker-id-content input').first().check({ force: true }).catch(ignoreSyllabusFailure);
	return page;
}

/**
 * Sanitizes an operating-system filename using only printable, portable characters.
 *
 * @param value - Suggested filename from a curriculum download.
 * @return Safe filename with a fallback when the suggestion becomes empty.
 */
function sFileName(value: string): string {
	const characters = [];
	for (const character of path.basename(value.replaceAll('\\', '/'))) {
		const code = character.codePointAt(0) || 0;
		characters.push(code < 0x20 || code === 0x7f || '<>:"|?*'.includes(character) ? '_' : character);
	}
	return (
		characters
			.join('')
			.trim()
			.replace(/[. ]+$/g, '') || 'syllabus.docx'
	);
}

/**
 * Absorbs a best-effort page cleanup or locator failure.
 *
 * @return `undefined` so callers can continue with optional controls.
 */
function ignoreSyllabusFailure(): undefined {
	return undefined;
}

/**
 * Compares syllabus archive entries by their stored paths.
 *
 * @param left - First archive entry.
 * @param right - Second archive entry.
 * @return Locale comparison result for the entry names.
 */
function compArchiveEntryNames(left: { entryName: string }, right: { entryName: string }): number {
	return left.entryName.localeCompare(right.entryName);
}

/**
 * Checks whether the syllabus page body is visible, treating a locator timeout as not ready.
 *
 * @param page - Curriculum page whose body is being checked.
 * @return Whether the body locator was visible within one second.
 */
async function isSyllabusBodyVisible(page: Page): Promise<boolean> {
	try {
		return await page.locator('body').isVisible({ timeout: 1_000 });
	} catch {
		return false;
	}
}

/**
 * Reads syllabus body text when available, treating a detached or unavailable body as empty.
 *
 * @param page - Curriculum page whose body is being read.
 * @return Body text, or an empty string when reading fails.
 */
async function readSyllabusBodyText(page: Page): Promise<string> {
	try {
		return await page.locator('body').innerText();
	} catch {
		return '';
	}
}

/**
 * Checks whether a curriculum page is public and contains readable content.
 *
 * @param page - Playwright page to inspect after opening or restoring browser state.
 *
 * @return `true` when the page is public and has readable body text.
 */
export async function isAustralianSyllabusPageReady(page: Page): Promise<boolean> {
	if (/login|saml|auth|signin/i.test(new URL(page.url()).pathname)) return false;
	if (!(await isSyllabusBodyVisible(page))) return false;
	const text = await readSyllabusBodyText(page);
	return text.trim().length > 0 && !/sign in to continue|authentication required/i.test(text.slice(0, 2_000));
}

/**
 * Downloads the default Word syllabus exposed by an Australian curriculum page.
 *
 * @param options - Jurisdiction, browser mode, output directory, and sign-in settings.
 *
 * @return Local filename, path, jurisdiction, and safe source URL.
 */
export async function fetchAustralianSyllabus(options: FetchAustralianSyllabusOptions): Promise<FetchedAustralianSyllabus> {
	const source = AUSTRALIAN_SYLLABUS_SOURCES[options.state];
	if (!source) throw new Error(`No curriculum source is configured for ${options.state}.`);
	const timeoutMs = options.timeoutMs || 30_000;
	/**
	 * Opens the selected jurisdiction's page in the authenticated browser context.
	 *
	 * @param context - Playwright context already configured by the shared workflow session.
	 * @return The page after its initial curriculum navigation.
	 */
	async function openSyllabusPage(context: import('playwright').BrowserContext): Promise<Page> {
		const page = await context.newPage();
		await page.goto(source.url, { waitUntil: 'domcontentloaded' });
		return page;
	}
	/**
	 * Waits for the jurisdiction page to start its Word download and reports a useful timeout.
	 *
	 * @param page - Prepared curriculum page.
	 * @return The Playwright download event.
	 */
	async function waitForSyllabusDownload(page: Page) {
		try {
			return await page.waitForEvent('download', { timeout: timeoutMs });
		} catch (cause) {
			throw new Error(`The ${options.state} curriculum page did not start a Word download.`, { cause });
		}
	}
	const session = await authenticateWorkflow<Page>({
		sessionName: `syllabus-${options.state.toLowerCase()}`,
		storageStatePath: options.storageStatePath || resolveWorkflowStorageStatePath(`syllabus-${options.state.toLowerCase()}`),
		headed: options.headed,
		interactive: options.interactive ?? options.headed ?? false,
		timeoutMs: options.timeoutMs || 15 * 60_000,
		createSession: options.createSession,
		open: openSyllabusPage,
		isReady: isAustralianSyllabusPageReady,
		onInteractiveStart: options.onInteractiveStart,
		authenticationRequiredMessage: 'The curriculum page requires sign-in. Retry with a headed interactive session.',
	});
	try {
		const page = await prepareAustralianSyllabusPage(session.value, options.state, options);
		const [download] = await Promise.all([waitForSyllabusDownload(page), page.getByRole('button', { name: /download as word/i }).click({ timeout: timeoutMs })]);
		const fileName = sFileName(options.fileName || download.suggestedFilename());
		const outputDir = path.resolve(options.outputDirectory || path.join(os.homedir(), 'Downloads', 'terra-symposium-scraping', 'syllabuses'));
		await mkdir(outputDir, { recursive: true, mode: 0o700 });
		const filePath = path.join(outputDir, fileName);
		await download.saveAs(filePath);
		return { state: options.state, sourceUrl: safeCanvasUrl(source.url), filePath, fileName, capturedAt: new Date().toISOString() };
	} finally {
		await session.close();
	}
}

/**
 * Copies a Word syllabus into the selected output directory or extracts one Word file from ZIP.
 *
 * @param file - Local Word document or ZIP archive path.
 * @param options - Output directory and optional filename.
 *
 * @return Absolute path and source information for the resulting Word document.
 */
export async function normalizeSyllabusDocument(file: string, options: NormalizeSyllabusDocumentOptions = {}): Promise<NormalizedSyllabusDocument> {
	const sourcePath = path.resolve(file);
	await access(sourcePath);
	const baseName = path.basename(options.fileName || sourcePath);
	const ext = path.extname(baseName) || path.extname(sourcePath);
	const outputDir = path.resolve(options.outputDirectory || path.join(os.homedir(), 'Downloads', 'terra-symposium-scraping', 'syllabuses'));
	await mkdir(outputDir, { recursive: true, mode: 0o700 });
	if (DOCX_I_REGEX.test(ext)) {
		const fileName = sFileName(baseName);
		const filePath = path.join(outputDir, fileName);
		if (sourcePath !== filePath) await copyFile(sourcePath, filePath);
		return { filePath, fileName, sourcePath };
	}
	if (!/^\.zip$/i.test(ext)) throw new Error(`Unsupported syllabus file type: ${ext || '(no extension)'}.`);
	const wordEntries = [];
	for (const entry of new AdmZip(sourcePath).getEntries()) {
		if (!entry.isDirectory && DOCX_I_REGEX.test(path.extname(entry.entryName)) && !/syllabus\s*support/i.test(entry.entryName)) wordEntries.push(entry);
	}
	wordEntries.sort(compArchiveEntryNames);
	const entry = wordEntries[0];
	if (!entry) throw new Error('No syllabus Word documents were found in the ZIP archive.');
	const archiveDir = path.join(outputDir, sFileName(path.basename(baseName, ext)));
	await mkdir(archiveDir, { recursive: true, mode: 0o700 });
	const fileName = sFileName(path.basename(entry.entryName));
	const filePath = path.join(archiveDir, fileName);
	await writeFile(filePath, entry.getData());
	return { filePath, fileName, sourcePath, archiveEntry: entry.entryName };
}
