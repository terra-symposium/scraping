import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { URL } from 'node:url';
import test from 'node:test';
import {
	canvasCourseUrl,
	canvasFileDownloadUrl,
	canvasFileUrl,
	canvasResponseFileName,
	discoverCanvasCourses,
	getCanvasModuleGroups,
	inferCanvasFileName,
	isCanvasReady,
	isCanvasPreviewBody,
	normalizeCanvasUrl,
	readCanvasPage,
	safeCanvasUrl,
	sanitizeCanvasFileName,
	scrapeCanvas,
	scrapeCanvasGroup,
} from '../dist/canvas.js';

/**
 * Builds an anchor-like Canvas DOM fixture used by serialized browser callbacks.
 * @param o - Anchor URL, optional title and text, module-row label, and dashboard-card title.
 * @returns A minimal DOM-like anchor consumed by Canvas extraction callbacks.
 */
function canvasAnchor(o) {
	const { href, title = '', text = '', label = '', cardTitle = '' } = o;
	return {
		href,
		textContent: text,
		querySelector: s => (s === '[data-testid="dashboard-card-title"]' && cardTitle ? { getAttribute: () => cardTitle } : null),
		getAttribute: n => (n === 'title' ? title : n === 'aria-label' ? text : null),
		closest: () => ({ textContent: label }),
	};
}

/**
 * Creates a Playwright page fixture for discovery, readiness, reading, and export tests.
 * @param options - Initial URL, dashboard and course anchors, module nodes, and dashboard readiness.
 * @returns The stub page and a getter for its current URL.
 */
function canvasPageFixture(options = {}) {
	const { currentUrl = 'https://canvas.example/dashboard', dashboardCourses = [], courses = [], modules = [], dashboardReady = false } = options;
	let pageUrl = currentUrl;
	let moduleReady = false;
	return {
		page: {
			url: () => pageUrl,
			goto: async u => {
				pageUrl = String(u);
				if (pageUrl.endsWith('/modules')) moduleReady = true;
			},
			waitForLoadState: async () => {},
			waitForURL: async p => {
				assert.equal(p(new URL(pageUrl)), true);
			},
			waitForFunction: async () => {},
			evaluate: async () => 'Canvas course page text',
			locator: s => {
				const locator = {
					first: () => locator,
					waitFor: async () => {},
					isVisible: async () => (s === '#context_modules' && moduleReady) || (s.startsWith('.ic-DashboardCard__link') && dashboardReady),
					evaluateAll: async read => {
						if (s === '.ic-DashboardCard__link[href]') return read(dashboardCourses);
						if (s === 'a[href]') return read(typeof courses === 'function' ? courses(pageUrl) : courses);
						if (s === '#context_modules .context_module') return read(modules);
						return read([]);
					},
					locator: nestedSelector => ({ evaluateAll: async read => read(nestedSelector === 'a[href]' ? [canvasAnchor({ href: 'https://canvas.example/courses/9/files/44', text: 'Slides' })] : []) }),
				};
				return locator;
			},
		},
		/** Current URL of the fixture page.
		 * @return The page URL.
		 */
		get url() {
			return pageUrl;
		},
	};
}

test('Canvas URL and file helpers normalize routes, names, and preview responses', () => {
	assert.equal(normalizeCanvasUrl('https://student:secret@canvas.example/courses/9?token=private#module'), 'https://canvas.example/courses/9');
	assert.throws(() => normalizeCanvasUrl('file:///tmp/canvas'), /HTTP or HTTPS/u);
	assert.equal(safeCanvasUrl('https://student:secret@canvas.example/courses/9?token=private#module'), 'https://canvas.example/courses/9');
	assert.equal(canvasCourseUrl('https://canvas.example/courses/9/modules?view=all'), 'https://canvas.example/courses/9');
	assert.equal(canvasCourseUrl('https://canvas.example/dashboard'), undefined);
	assert.equal(canvasFileUrl('https://canvas.example/courses/9/files/44/download?token=private'), 'https://canvas.example/courses/9/files/44');
	assert.equal(canvasFileDownloadUrl('https://canvas.example/courses/9/files/44?download=1'), 'https://canvas.example/courses/9/files/44/download?download_frd=1');
	assert.equal(canvasResponseFileName("attachment; filename*=UTF-8''Lecture%20notes.pdf"), 'Lecture notes.pdf');
	assert.equal(inferCanvasFileName('lecture.bin', 'application/pdf; charset=binary'), 'lecture.pdf');
	assert.equal(sanitizeCanvasFileName('../../Lecture Notes.pdf'), 'lecture-notes.pdf');
	assert.equal(isCanvasPreviewBody(Buffer.from('<html><body class="ic-Layout">Preview</body></html>'), 'text/html'), true);
	assert.equal(isCanvasPreviewBody(Buffer.from('<html><body>Not a Canvas preview</body></html>'), 'text/html'), false);
});

test('Canvas module discovery classifies pages, files, and external links before filtering', async () => {
	const page = {
		locator: selector =>
			selector === '#context_modules'
				? { waitFor: async () => {} }
				: {
						evaluateAll: async readGroups =>
							readGroups([
								{
									querySelector: name => (name === '.name' ? { textContent: 'Week One' } : null),
									querySelectorAll: () => [
										{ href: 'https://canvas.example/courses/9/pages/intro', textContent: 'Introduction', closest: () => ({ textContent: 'Page' }) },
										{ href: 'https://canvas.example/courses/9/files/44', textContent: 'Lecture slides', closest: () => ({ textContent: 'Attachment File' }) },
										{ href: 'https://example.edu/reading', textContent: 'Reading link', closest: () => ({ textContent: 'External Link' }) },
									],
								},
							]),
					},
	};

	assert.deepEqual(await getCanvasModuleGroups(page, ['week one']), [
		{
			title: 'Week One',
			items: [
				{ title: 'Introduction', url: 'https://canvas.example/courses/9/pages/intro', type: 'page' },
				{ title: 'Lecture slides', url: 'https://canvas.example/courses/9/files/44', type: 'file' },
				{ title: 'Reading link', url: 'https://example.edu/reading', type: 'link' },
			],
		},
	]);
	assert.deepEqual(await getCanvasModuleGroups(page, ['missing week']), []);
});

test('Canvas group export deduplicates downloads and strips secrets from recorded links', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'terra-canvas-group-'));
	const requestedUrls = [];
	let disposed = 0;
	try {
		const result = await scrapeCanvasGroup({
			page: {},
			request: {
				get: async url => {
					requestedUrls.push(url);
					return {
						ok: () => true,
						status: () => 200,
						url: () => url,
						headers: () => ({ 'content-disposition': "attachment; filename*=UTF-8''Study%20Guide.pdf", 'content-type': 'application/pdf' }),
						body: async () => Buffer.from('pdf bytes'),
						dispose: async () => disposed++,
					};
				},
			},
			course: { title: 'Course Name', url: 'https://student:secret@canvas.example/courses/9?token=private' },
			group: {
				title: 'Week 1',
				items: [
					{ title: 'Slides', url: 'https://student:secret@canvas.example/courses/9/files/44?token=private', type: 'file' },
					{ title: 'Duplicate Slides', url: 'https://canvas.example/courses/9/files/44/download?other=private', type: 'file' },
					{ title: 'Reading', url: 'https://reader:secret@example.edu/book?token=private#chapter', type: 'link' },
				],
			},
			output: root,
		});

		assert.equal(requestedUrls.length, 1);
		assert.equal(requestedUrls[0], 'https://canvas.example/courses/9/files/44/download?download_frd=1');
		assert.equal(disposed, 1);
		assert.equal(result.course.url, 'https://canvas.example/courses/9');
		assert.deepEqual(result.links, ['https://example.edu/book']);
		assert.equal(result.errors.length, 0);
		assert.equal(result.files.length, 2);
		const downloadedFile = result.files.find(file => file.name === 'Study Guide.pdf');
		assert.ok(downloadedFile);
		assert.equal(path.basename(downloadedFile.path), '44-study-guide.pdf');
		assert.equal(downloadedFile.sourceUrl, 'https://canvas.example/courses/9/files/44');
		assert.equal(await readFile(downloadedFile.path, 'utf8'), 'pdf bytes');
		assert.doesNotMatch(JSON.stringify(result), /student|reader:secret|token=private|other=private/u);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('Canvas course discovery canonicalizes and filters the course list', async () => {
	const fixture = canvasPageFixture({
		dashboardCourses: [
			canvasAnchor({ href: 'https://canvas.example/courses/9/?module=1', text: 'Course 9', cardTitle: 'Biology Semester 1 2026' }),
			canvasAnchor({ href: 'https://canvas.example/courses/9', text: 'Duplicate title', cardTitle: 'Biology Semester 1 2026' }),
			canvasAnchor({ href: 'https://canvas.example/courses/10', text: 'Course 10', cardTitle: 'Professional development' }),
			canvasAnchor({ href: 'https://canvas.example/courses/not-a-course', text: 'Invalid course' }),
		],
		courses: [canvasAnchor({ href: 'https://canvas.example/courses/11', text: 'Ignored fallback course' })],
	});

	assert.deepEqual(await discoverCanvasCourses(fixture.page, 'https://canvas.example/dashboard'), [{ title: 'Biology Semester 1 2026', url: 'https://canvas.example/courses/9' }]);
	assert.deepEqual(await discoverCanvasCourses(fixture.page, 'https://canvas.example/dashboard', { includeAllCourses: true }), [
		{ title: 'Biology Semester 1 2026', url: 'https://canvas.example/courses/9' },
		{ title: 'Professional development', url: 'https://canvas.example/courses/10' },
	]);
});

test('Canvas readiness rejects sign-in routes and opens a course module page when needed', async () => {
	assert.equal(await isCanvasReady(canvasPageFixture({ currentUrl: 'https://canvas.example/login' }).page), false);
	assert.equal(await isCanvasReady(canvasPageFixture({ dashboardReady: true }).page), true);

	const course = canvasPageFixture({ currentUrl: 'https://canvas.example/courses/9' });
	assert.equal(await isCanvasReady(course.page), true);
	assert.equal(course.url, 'https://canvas.example/courses/9/modules');
});

test('Canvas page reading returns visible text and canonical file links', async () => {
	const content = await readCanvasPage(canvasPageFixture({ currentUrl: 'https://canvas.example/courses/9/modules/items/2' }).page, {
		title: 'Week One',
		url: 'https://canvas.example/courses/9/pages/intro?token=private',
		type: 'page',
	});

	assert.equal(content.text, 'Week One\nhttps://canvas.example/courses/9/pages/intro\n\nCanvas course page text');
	assert.deepEqual(content.files, [{ title: 'Slides', url: 'https://canvas.example/courses/9/files/44', type: 'file' }]);
});

test('Canvas export uses the injected session and writes a local manifest and download', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'terra-canvas-export-'));
	const output = path.join(root, 'export');
	const storageStatePath = path.join(root, 'state.json');
	// terra-quality-ignore single-use -- The injected session reuses one captured page fixture across requests.
	const fixture = canvasPageFixture({
		courses: [canvasAnchor({ href: 'https://canvas.example/courses/9', text: 'Course 9', title: 'Course 9' })],
		modules: [
			(items => ({ querySelector: s => (s === '.name' ? { textContent: 'Week One' } : null), querySelectorAll: () => items.map(canvasAnchor) }))([
				canvasAnchor({ href: 'https://canvas.example/courses/9/files/44?token=private', text: 'Slides', label: 'Attachment File' }),
			]),
		],
	});
	let closeCount = 0;
	let sessionOptions;
	try {
		const result = await scrapeCanvas({
			canvasUrl: 'https://canvas.example/courses/9?token=private',
			output,
			storageStatePath,
			includeAllCourses: true,
			log: () => {},
			createSession: async options => {
				sessionOptions = options;
				return {
					browser: {},
					context: {
						newPage: async () => fixture.page,
						request: {
							get: async url => ({
								ok: () => true,
								status: () => 200,
								url: () => url,
								headers: () => ({ 'content-disposition': 'attachment; filename="slides.pdf"', 'content-type': 'application/pdf' }),
								body: async () => Buffer.from('course slides'),
								dispose: async () => {},
							}),
						},
						storageState: async ({ path: target }) => {
							await writeFile(target, JSON.stringify({ cookies: [], origins: [] }));
						},
					},
					close: async () => closeCount++,
				};
			},
		});

		assert.equal(sessionOptions.headed, false);
		assert.equal(sessionOptions.storageStatePath, storageStatePath);
		assert.equal(closeCount, 1);
		assert.deepEqual(result.manifest.courses, [{ title: 'Course 9', url: 'https://canvas.example/courses/9', groups: ['Week One'] }]);
		assert.equal(result.manifest.groups[0].files[1].name, 'slides.pdf');
		assert.equal(await readFile(result.manifest.groups[0].files[1].path, 'utf8'), 'course slides');
		assert.deepEqual(JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8')), result.manifest);
		await access(storageStatePath);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
