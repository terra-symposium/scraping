import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import AdmZip from 'adm-zip';
import {
	AUSTRALIAN_SYLLABUS_SOURCES,
	fetchAustralianSyllabus,
	isAustralianSyllabusPageReady,
	normalizeSyllabusDocument,
	prepareAustralianSyllabusPage,
} from '../dist/workflows/syllabus.js';

/**
 * Verifies archive normalization selects the first supported syllabus document and skips support files.
 */
async function normArchiveSelectsOneSyllabusDocument() {
	const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'scraping-syllabus-test-'));
	try {
		const archivePath = path.join(temporaryRoot, 'curriculum.zip');
		const outputDir = path.join(temporaryRoot, 'output');
		const archive = new AdmZip();
		archive.addFile('syllabus support/Support.docx', Buffer.from('support document'));
		archive.addFile('z-unit.docx', Buffer.from('later document'));
		archive.addFile('a-unit.docx', Buffer.from('selected document'));
		archive.writeZip(archivePath);

		const result = await normalizeSyllabusDocument(archivePath, { outputDirectory: outputDir });

		assert.equal(result.fileName, 'a-unit.docx');
		assert.equal(result.archiveEntry, 'a-unit.docx');
		assert.equal(await readFile(result.filePath, 'utf8'), 'selected document');
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
}

test('syllabus archive normalization ignores support documents and selects deterministically', normArchiveSelectsOneSyllabusDocument);

test('syllabus normalization confines an overridden filename to the selected output directory', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'scraping-syllabus-name-test-'));
	const sourcePath = path.join(root, 'source.docx');
	const outputDirectory = path.join(root, 'output');
	try {
		await writeFile(sourcePath, 'word document');
		const result = await normalizeSyllabusDocument(sourcePath, { outputDirectory, fileName: '../../Outside Report.docx' });

		assert.equal(result.fileName, 'Outside Report.docx');
		assert.equal(result.filePath, path.join(outputDirectory, 'Outside Report.docx'));
		assert.equal(await readFile(result.filePath, 'utf8'), 'word document');
		assert.equal(await readFile(sourcePath, 'utf8'), 'word document');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('syllabus page preparation navigates to the configured source only when needed', async () => {
	let currentUrl = 'about:blank';
	const navigations = [];
	const page = {
		url: () => currentUrl,
		goto: async (url) => {
			navigations.push(url);
			currentUrl = url;
		},
	};

	assert.equal(await prepareAustralianSyllabusPage(page, 'QLD'), page);
	assert.equal(await prepareAustralianSyllabusPage(page, 'QLD'), page);
	assert.deepEqual(navigations, [AUSTRALIAN_SYLLABUS_SOURCES.QLD.url]);
	await assert.rejects(prepareAustralianSyllabusPage(page, 'NOPE'), /No curriculum source/u);
});

test('NSW syllabus preparation fills the picker and selects every enabled checkbox', async () => {
	const calls = [];
	const checks = [false, false, true];
	const disabled = [false, true, false];
	const checkboxes = checks.map((checked, index) => ({
		isDisabled: async () => disabled[index],
		isChecked: async () => checked,
		click: async (options) => {
			calls.push(['checkbox-click', index, options]);
			checks[index] = true;
		},
	}));
	const page = {
		url: () => AUSTRALIAN_SYLLABUS_SOURCES.NSW.url,
		locator: (selector) => {
			if (selector === '.custom-view__syllabus-container #search') return { fill: async (value) => calls.push(['fill', value]) };
			if (selector === '.custom-view__syllabus-container label') return { filter: () => ({ first: () => ({ click: async () => calls.push(['choose']) }) }) };
			if (selector === '.tree-picker-id-primary-group, .tree-picker-id-secondary-group')
				return {
					locator: (inputSelector) =>
						inputSelector.includes(':not(:disabled)')
							? { first: () => ({ waitFor: async () => calls.push(['ready']) }) }
							: { count: async () => checkboxes.length, nth: (index) => checkboxes[index] },
				};
			if (selector === '.tree-picker-id-content input') return { first: () => ({ check: async (options) => calls.push(['content-check', options]) }) };
			throw new Error(`Unexpected selector: ${selector}`);
		},
	};

	assert.equal(await prepareAustralianSyllabusPage(page, 'NSW', { syllabusName: 'English K–10' }), page);
	assert.deepEqual(calls.slice(0, 3), [['fill', 'English K–10'], ['choose'], ['ready']]);
	assert.deepEqual(
		calls.filter(([kind]) => kind === 'checkbox-click').map(([, index]) => index),
		[0],
	);
	assert.equal(checks[1], false);
	assert.deepEqual(calls.at(-1), ['content-check', { force: true }]);
});

test('syllabus readiness rejects login routes and sign-in pages', async () => {
	const page = (url, text) => ({ url: () => url, locator: () => ({ isVisible: async () => true, innerText: async () => text }) });
	assert.equal(await isAustralianSyllabusPageReady(page('https://example.edu/login', 'Public syllabus')), false);
	assert.equal(await isAustralianSyllabusPageReady(page(AUSTRALIAN_SYLLABUS_SOURCES.QLD.url, 'Sign in to continue')), false);
	assert.equal(await isAustralianSyllabusPageReady(page(AUSTRALIAN_SYLLABUS_SOURCES.QLD.url, 'Curriculum resources')), true);
});

test('syllabus download completes interactive authentication and closes each session', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'terra-syllabus-workflow-'));
	const storageStatePath = path.join(root, 'state.json');
	const outputDirectory = path.join(root, 'output');
	const headedModes = [];
	const closedModes = [];
	let storedAuthentication = false;
	let interactiveStarts = 0;
	try {
		const result = await fetchAustralianSyllabus({
			state: 'QLD',
			storageStatePath,
			outputDirectory,
			interactive: true,
			timeoutMs: 1_000,
			onInteractiveStart: () => interactiveStarts++,
			createSession: async ({ headed, storageStatePath: requestedStatePath }) => {
				headedModes.push(headed);
				assert.equal(requestedStatePath, storageStatePath);
				const page = {
					currentUrl: 'about:blank',
					url() {
						return this.currentUrl;
					},
					async goto(url) {
						this.currentUrl = !headed && !storedAuthentication ? 'https://curriculum.example/login' : url;
					},
					locator: (selector) => {
						assert.equal(selector, 'body');
						return { isVisible: async () => true, innerText: async () => 'Curriculum resources' };
					},
					getByRole: (role, options) => {
						assert.equal(role, 'button');
						assert.equal(options.name.toString(), '/download as word/i');
						return { click: async () => {} };
					},
					waitForEvent: async (event) => {
						assert.equal(event, 'download');
						return { suggestedFilename: () => 'Queensland Curriculum.docx', saveAs: async (target) => writeFile(target, Buffer.from('downloaded syllabus')) };
					},
				};
				const context = {
					newPage: async () => page,
					storageState: async ({ path: target }) => {
						storedAuthentication = true;
						await writeFile(target, JSON.stringify({ cookies: [], origins: [] }));
					},
				};
				return { browser: {}, context, close: async () => closedModes.push(headed) };
			},
		});

		assert.deepEqual(headedModes, [false, true, false]);
		assert.deepEqual(closedModes, [false, true, false]);
		assert.equal(interactiveStarts, 1);
		assert.equal(result.fileName, 'Queensland Curriculum.docx');
		assert.equal(result.state, 'QLD');
		assert.equal(result.sourceUrl, AUSTRALIAN_SYLLABUS_SOURCES.QLD.url);
		assert.equal(await readFile(result.filePath, 'utf8'), 'downloaded syllabus');
		assert.deepEqual(JSON.parse(await readFile(storageStatePath, 'utf8')), { cookies: [], origins: [] });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('syllabus download fails clearly and closes its session when authentication is missing', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'terra-syllabus-auth-required-'));
	let closeCount = 0;
	try {
		await assert.rejects(
			fetchAustralianSyllabus({
				state: 'QLD',
				storageStatePath: path.join(root, 'state.json'),
				createSession: async () => {
					const page = {
						currentUrl: 'about:blank',
						url() {
							return this.currentUrl;
						},
						async goto() {
							this.currentUrl = 'https://curriculum.example/login';
						},
					};
					return { browser: {}, context: { newPage: async () => page }, close: async () => closeCount++ };
				},
			}),
			/The curriculum page requires sign-in/u,
		);
		assert.equal(closeCount, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
