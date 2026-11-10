/**
 * src/canvas.ts
 */

/*//////////////////////////////////////////////////
IMPORTS
//////////////////////////////////////////////////*/

// API
import os from 'node:os';
import path from 'node:path';
import { authenticateWorkflow, resolveWorkflowStorageStatePath } from './workflows/browser.js';
import { mkdir, writeFile } from 'node:fs/promises';

// TYPES
import type { APIRequestContext, APIResponse, Page } from 'playwright';

/*//////////////////////////////////////////////////
CONFIG
//////////////////////////////////////////////////*/

/** One file, page, or external link discovered in a Canvas module group. */
export type CanvasItem = { title: string; url: string; type: 'file' | 'page' | 'link' };
/** A Canvas course with its display title and canonical course URL. */
export type CanvasCourse = { title: string; url: string };
/** A Canvas course module and the resources listed inside it. */
export type CanvasGroup = { title: string; items: CanvasItem[] };
/** A locally saved Canvas file with its optional sanitized source URL. */
export type CanvasFile = { path: string; name: string; sourceUrl?: string };
/** Captured files, text, links, and per-item errors from one module group. */
export type ExportedGroup = { course: CanvasCourse; title: string; files: CanvasFile[]; textPath: string; links: string[]; text: string; errors: string[] };
/** Complete local Canvas export manifest with course and module summaries. */
export type CanvasExportManifest = { source: string; mode: 'download'; courses: { title: string; url: string; groups: string[] }[]; groups: ExportedGroup[] };
/** Browser, course-selection, output, and logging options for a Canvas export. */
export type CanvasScrapeOptions = {
	canvasUrl: string;
	output?: string;
	groupMatches?: string[];
	storageStatePath?: string;
	headed?: boolean;
	interactive?: boolean;
	includeAllCourses?: boolean;
	log?: (message: string, failure?: boolean) => void;
};
/** Result returned by a Canvas export after writing its manifest and log. */
export type CanvasScrapeResult = { output: string; manifest: CanvasExportManifest; logs: string[] };
/** Authenticated page, request, course, and output inputs for one course scrape. */
export type ScrapeCanvasCourseOptions = {
	page: Page;
	request: APIRequestContext;
	course: CanvasCourse;
	output: string;
	groupMatches?: string[];
	log?: (message: string, failure?: boolean) => void;
};
const TEXT_EXTS = new Set([
	'.asm',
	'.bat',
	'.c',
	'.cc',
	'.conf',
	'.cpp',
	'.css',
	'.cxx',
	'.def',
	'.diff',
	'.eml',
	'.graphql',
	'.h',
	'.hh',
	'.htm',
	'.html',
	'.ics',
	'.ifb',
	'.ini',
	'.java',
	'.js',
	'.json',
	'.ksh',
	'.list',
	'.log',
	'.mht',
	'.mhtml',
	'.md',
	'.markdown',
	'.mjs',
	'.patch',
	'.pl',
	'.properties',
	'.py',
	'.rst',
	'.s',
	'.sh',
	'.sql',
	'.srt',
	'.text',
	'.toml',
	'.ts',
	'.tsx',
	'.tsv',
	'.txt',
	'.vcf',
	'.vtt',
	'.xml',
	'.yaml',
	'.yml',
]);
/*//////////////////////////////////////////////////
HELPERS
//////////////////////////////////////////////////*/

/**
 * Removes credentials, query parameters, and fragments before a source URL is recorded.
 *
 * @param value - Canvas URL to sanitize before storing or displaying.
 *
 * @return The URL without credentials, query parameters, or fragment data.
 */
export function safeCanvasUrl(value: string): string {
	try {
		const url = new URL(value);
		url.username = '';
		url.password = '';
		url.search = '';
		url.hash = '';
		return url.href;
	} catch {
		return String(value).replace(/([?#]).*$/, '');
	}
}

/**
 * Converts a course file URL into its stable Canvas file URL.
 *
 * @param value - Canvas course file URL or a URL containing its file route.
 *
 * @return Canonical `/courses/{course}/files/{file}` URL, when recognized.
 */
export function canvasFileUrl(value: string): string | undefined {
	try {
		const url = new URL(value);
		const match = url.pathname.match(/^\/courses\/(\d+)\/files\/(\d+)(?:\/|$)/);
		return match ? `${url.origin}/courses/${match[1]}/files/${match[2]}` : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Returns Canvas's authenticated file-download endpoint for a course file URL.
 *
 * @param value - Canvas file URL to convert to its authenticated endpoint.
 *
 * @return Download endpoint URL, or `undefined` when no Canvas file route exists.
 */
export function canvasFileDownloadUrl(value: string): string | undefined {
	const base = canvasFileUrl(value);
	return base ? `${base}/download?download_frd=1` : undefined;
}

/**
 * Produces the stable identity used to match Canvas source routes across imports.
 *
 * @param value - Canvas URL whose stable course, page, or file identity is needed.
 *
 * @return Lower-cased origin and normalized route, retaining a normalized fragment.
 */
export function canvasSourceKey(value: string): string {
	const url = new URL(value);
	const fragment = decodeURIComponent(url.hash.replace(/^#/, '')).trim().toLowerCase();
	const segments = url.pathname.split('/');
	while (segments.length > 1 && segments.at(-1) === '') segments.pop();
	return `${url.origin.toLowerCase()}${segments.join('/') || '/'}${fragment ? `#${fragment}` : ''}`;
}

/**
 * Detects a Canvas HTML preview that was returned in place of attachment bytes.
 *
 * @param body - Bytes returned by a Canvas attachment request.
 * @param contentType - Response content type supplied by the server.
 *
 * @return `true` when the response resembles a Canvas HTML preview, not a file.
 */
export function isCanvasPreviewBody(body: Buffer, contentType: string): boolean {
	if (!/html/i.test(contentType)) return false;
	const head = body.subarray(0, 200_000).toString('utf8');
	return /<html\b/i.test(head) && /ic-Layout|data-attachment_name|id=["']application["']/i.test(head);
}

/**
 * Returns a canonical course URL when the supplied URL is scoped to one Canvas course.
 *
 * @param value - URL that may be scoped to a Canvas course.
 *
 * @return Canonical `/courses/{course}` URL, or `undefined` for another route.
 */
export function canvasCourseUrl(value: string): string | undefined {
	try {
		const url = new URL(value);
		const match = url.pathname.match(/^\/courses\/(\d+)(?:\/|$)/);
		return match ? `${url.origin}/courses/${match[1]}` : undefined;
	} catch {
		return undefined;
	}
}

function sMessage(value: unknown): string {
	return String(value).replace(/https?:\/\/[^\s"'<>]+/g, (candidate) => safeCanvasUrl(candidate));
}

function sName(value: string): string {
	return (
		value
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/gi, '-')
			.replace(/^-+|-+$/g, '')
			.toLowerCase()
			.slice(0, 120)
			.replace(/-+$/g, '') || 'resource'
	);
}

/**
 * Produces a safe Canvas download filename while preserving a short extension.
 *
 * @param value - Suggested filename from Canvas or an item title.
 *
 * @return Basename with unsupported characters removed and a safe fallback.
 */
export function sanitizeCanvasFileName(value: string): string {
	const norm = path.basename(value.replaceAll('\\', '/'));
	const ext = path.extname(norm).toLowerCase();
	const sExt = /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
	return `${sName(sExt ? norm.slice(0, -sExt.length) : norm)}${sExt}`;
}

/**
 * Corrects a Canvas download's extension using its response content type.
 *
 * @param fileName - Filename from the Canvas response or resource title.
 * @param contentType - HTTP `Content-Type` response header.
 *
 * @return Filename with a content-type extension when one can be inferred.
 */
export function inferCanvasFileName(fileName: string, contentType: string): string {
	const mime = contentType.toLowerCase().split(';')[0].trim();
	const inferred = (
		{
			'application/pdf': '.pdf',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
			'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
			'image/gif': '.gif',
			'image/jpeg': '.jpg',
			'image/png': '.png',
			'image/webp': '.webp',
		} as Record<string, string>
	)[mime];
	const ext = path.extname(fileName).toLowerCase();
	if (inferred) return ext === inferred ? fileName : ext ? `${fileName.slice(0, -ext.length)}${inferred}` : `${fileName}${inferred}`;
	if (ext && (TEXT_EXTS.has(ext) || /^\.(?:gif|jpeg|jpg|png|webp)$/i.test(ext) || ['.pdf', '.docx', '.pptx'].includes(ext))) return fileName;
	const textExt = ({ 'application/json': '.json', 'application/x-ndjson': '.json' } as Record<string, string>)[mime] || (mime.startsWith('text/') ? '.txt' : '');
	if (textExt && ext) return `${fileName.slice(0, -ext.length)}${textExt}`;
	if (textExt) return `${fileName}${textExt}`;
	if (ext && !TEXT_EXTS.has(ext) && /^(?:text\/|application\/(?:json|x-ndjson))/.test(mime)) return `${fileName.slice(0, -ext.length)}.txt`;
	return fileName;
}

/**
 * Reads a filename from an HTTP `Content-Disposition` header.
 *
 * @param header - Response header with a `filename` or RFC 5987 `filename*` value.
 *
 * @return Decoded filename when one is present.
 */
export function canvasResponseFileName(header?: string): string | undefined {
	if (!header) return undefined;
	const encoded = header
		.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i)?.[1]
		?.trim()
		.replace(/^"|"$/g, '');
	if (encoded) {
		try {
			return decodeURIComponent(encoded);
		} catch {
			return encoded;
		}
	}
	return header.match(/filename\s*=\s*"?([^";]+)/i)?.[1]?.trim();
}

/**
 * Fetches a Canvas file through its authenticated download endpoint.
 *
 * @param request - Authenticated Playwright API request context.
 * @param value - Canvas file URL or its download URL.
 *
 * @return HTTP response after resolving Canvas's intermediate download route.
 */
export async function downloadCanvasFile(request: APIRequestContext, value: string): Promise<APIResponse> {
	let response = await request.get(canvasFileDownloadUrl(value) || value, { timeout: 60_000 });
	const resolvedDownload = canvasFileDownloadUrl(response.url());
	if (resolvedDownload && resolvedDownload !== response.url()) {
		await response.dispose();
		response = await request.get(resolvedDownload, { timeout: 60_000 });
	}
	return response;
}

/**
 * Discovers courses exposed by the current dashboard or course list.
 *
 * @param page - Authenticated Playwright page positioned on a Canvas page.
 * @param initialUrl - Original Canvas URL used to scope dashboard discovery.
 * @param options - Optional course-title and dashboard-scope controls.
 *
 * @return Unique courses, filtered to semester-like titles unless all are requested.
 */
export async function discoverCanvasCourses(page: Page, initialUrl: string, options: { includeAllCourses?: boolean; dashboardScope?: boolean } = {}): Promise<CanvasCourse[]> {
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page
		.locator('.ic-DashboardCard__link, .ic-DashboardCard a[href], a[href*="/courses/"]')
		.first()
		.waitFor({ state: 'attached', timeout: 15_000 })
		.catch(() => undefined);
	const collect = async (selector: string): Promise<CanvasCourse[]> =>
		page.locator(selector).evaluateAll((nodes) =>
			nodes.flatMap((node) => {
				const link = node as HTMLAnchorElement;
				const url = new URL(link.href);
				const match = url.pathname.match(/^\/courses\/(\d+)\/?$/);
				if (!match) return [];
				return [
					{
						title:
							link.querySelector('[data-testid="dashboard-card-title"]')?.getAttribute('title')?.trim() ||
							link.getAttribute('title')?.trim() ||
							link.textContent?.trim() ||
							link.getAttribute('aria-label')?.trim() ||
							`Course ${match[1]}`,
						url: `${url.origin}/courses/${match[1]}`,
					},
				];
			}),
		);
	const dashboardCourses = await collect('.ic-DashboardCard__link[href]');
	let found = dashboardCourses.length ? dashboardCourses : await collect('a[href]');
	if (!found.length && options.dashboardScope) return [];
	if (!found.length && !/^\/courses(?:\/|$)/.test(new URL(page.url()).pathname)) {
		await page.goto(new URL('/courses', initialUrl).href, { waitUntil: 'domcontentloaded' });
		await page.waitForLoadState('networkidle').catch(() => undefined);
		found = await collect('a[href]');
	}
	return [...new Map(found.map((course) => [course.url, course])).values()].filter(
		(course) =>
			options.includeAllCourses ||
			/\b(?:(?:autumn|spring|summer|winter)\s+\d{4}|\d{4}\s+(?:autumn|spring|summer|winter)|(?:semester|term)\s+\d{1,2}\s+\d{4}|\d{4}\s+(?:semester|term)\s+\d{1,2})\b/i.test(
				course.title,
			),
	);
}

/**
 * Reads and classifies the module groups currently visible on a Canvas course page.
 *
 * @param page - Authenticated page containing a Canvas course module list.
 * @param matches - Optional case-insensitive title fragments for module filtering.
 *
 * @return Module groups with resources classified as files, pages, or links.
 */
export async function getCanvasModuleGroups(page: Page, matches: string[] = []): Promise<CanvasGroup[]> {
	await page
		.locator('#context_modules')
		.waitFor({ state: 'visible', timeout: 10_000 })
		.catch(() => undefined);
	const found = await page
		.locator('#context_modules .context_module')
		.evaluateAll((nodes) =>
			nodes.map((node) => ({
				title: node.querySelector('.name')?.textContent?.trim() || node.querySelector('h2')?.textContent?.trim() || '',
				items: Array.from(node.querySelectorAll<HTMLAnchorElement>('.ig-row a[href], .context_module_item a[href]')).map((link) => ({
					title: link.textContent?.trim() || 'Untitled resource',
					url: link.href,
					label: link.closest('.ig-row, .context_module_item')?.textContent || '',
				})),
			})),
		);
	return (matches.length ? found.filter((group) => matches.some((match) => group.title.toLowerCase().includes(match.toLowerCase()))) : found).map((group) => ({
		title: group.title,
		items: group.items.map((i) => ({
			title: i.title,
			url: i.url,
			type: /attachment|file/i.test(i.label)
				? 'file'
				: /page/i.test(i.label) || /\/courses\/\d+\/pages\//.test(i.url)
					? 'page'
					: /\/files\/|download(?:\?|$)/.test(i.url)
						? 'file'
						: 'link',
		})),
	}));
}

/**
 * Opens a Canvas page item and collects its readable text and linked files.
 *
 * @param page - Authenticated Playwright page to navigate.
 * @param item - Canvas page item discovered from a module group.
 *
 * @return Page text and file links found in its body.
 */
/**
 * Reads a Canvas page item and returns its text and linked Canvas files.
 *
 * @param page - Authenticated Playwright page to navigate.
 * @param item - Canvas page item discovered from a module group.
 *
 * @return Page text and file links found in its body.
 */
export async function readCanvasPage(page: Page, item: CanvasItem): Promise<{ text: string; files: CanvasItem[] }> {
	await page.goto(item.url, { waitUntil: 'domcontentloaded' });
	await page.waitForURL((url) => !url.pathname.includes('/modules/items/'), { timeout: 30_000 }).catch(() => undefined);
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page
		.waitForFunction(
			() =>
				['#content', '#wiki_page_show .show-content', '.show-content', 'main'].some((selector) =>
					[...document.querySelectorAll(selector)].some((element) => element.textContent?.trim()),
				),
			null,
			{ timeout: 30_000 },
		)
		.catch(() => undefined);
	const bodyText = await page.evaluate(
		() =>
			['#content', '#wiki_page_show .show-content', '.show-content', 'main']
				.flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)])
				.filter((element) => element.textContent?.trim() && element.getBoundingClientRect().height > 0)
				.sort((left, right) => (right.innerText?.length || 0) - (left.innerText?.length || 0))[0]
				?.innerText.trim() || '',
	);
	if (!bodyText) throw new Error(`Canvas page returned no readable content after redirect to ${safeCanvasUrl(page.url())}.`);
	const seen = new Set<string>();
	return {
		text: `${item.title}\n${safeCanvasUrl(item.url)}\n\n${bodyText}`,
		files: (
			await page
				.locator('#content, #wiki_page_show .show-content, .show-content, main')
				.first()
				.locator('a[href]')
				.evaluateAll((nodes) => nodes.map((node) => ({ title: node.textContent?.trim() || '', url: (node as HTMLAnchorElement).href })))
		).flatMap((link) => {
			const fileUrl = canvasFileUrl(link.url);
			if (!fileUrl || seen.has(fileUrl)) return [];
			seen.add(fileUrl);
			return [{ title: link.title || 'Untitled file', url: link.url, type: 'file' as const }];
		}),
	};
}

/**
 * Scrapes one authenticated Canvas module group and writes its source files locally.
 *
 * @param options - Authenticated Canvas resources, module group, output path, and logger.
 *
 * @return Local text and attachment records, source links, and any item errors.
 */
export async function scrapeCanvasGroup(options: {
	page: Page;
	request: APIRequestContext;
	course: CanvasCourse;
	group: CanvasGroup;
	output: string;
	log?: (message: string, failure?: boolean) => void;
}): Promise<ExportedGroup> {
	const { page, request, course, group, log = () => undefined } = options;
	const folder = path.join(path.resolve(options.output), sName(course.title), sName(group.title));
	await mkdir(folder, { recursive: true });
	log(`staging ${course.title} / ${group.title} (${group.items.length} module items)`);
	const record: ExportedGroup = { course: { title: course.title, url: safeCanvasUrl(course.url) }, title: group.title, files: [], textPath: '', links: [], text: '', errors: [] };
	const items = [...new Map(group.items.map((i) => [i.url, i])).values()];
	const downloaded = new Set<string>();
	for (let index = 0; index < items.length; index++) {
		const item = items[index];
		try {
			if (item.type === 'page') {
				log(`reading page ${item.title}`);
				const content = await readCanvasPage(page, item);
				record.text += `${record.text ? '\n\n---\n\n' : ''}${content.text}`;
				items.push(...content.files);
			} else if (item.type === 'file') {
				const source = canvasFileUrl(item.url);
				const identity = source || safeCanvasUrl(item.url);
				if (downloaded.has(identity)) continue;
				downloaded.add(identity);
				log(`downloading ${item.title}`);
				const response = await downloadCanvasFile(request, item.url);
				try {
					if (!response.ok()) throw new Error(`download returned HTTP ${response.status()}`);
					const headers = response.headers();
					const fileName = canvasResponseFileName(headers['content-disposition']) || item.title;
					const filePath = path.join(
						folder,
						`${sName((source || canvasFileUrl(response.url()))?.split('/').at(-1) || fileName)}-${sanitizeCanvasFileName(inferCanvasFileName(fileName, headers['content-type'] || ''))}`,
					);
					const body = await response.body();
					if (isCanvasPreviewBody(body, headers['content-type'] || '')) throw new Error('Canvas returned an HTML preview instead of the file download.');
					await writeFile(filePath, body);
					record.files.push({ path: filePath, name: fileName, sourceUrl: source ? safeCanvasUrl(source) : undefined });
				} finally {
					await response.dispose();
				}
			} else {
				record.links.push(safeCanvasUrl(item.url));
			}
		} catch (err) {
			const message = `${item.title}: ${sMessage(err instanceof Error ? err.message : err)}`;
			record.errors.push(message);
			log(message, true);
		}
	}
	const textPath = path.join(folder, `${sName(group.title)}.txt`);
	await writeFile(textPath, record.text);
	record.textPath = textPath;
	record.files.unshift({ path: textPath, name: path.basename(textPath) });
	return record;
}

/**
 * Scrapes all selected module groups from one authenticated Canvas course.
 *
 * @param options - Authenticated page, request context, course, output, and filters.
 *
 * @return Captured module groups for the course.
 */
export async function scrapeCanvasCourse(options: ScrapeCanvasCourseOptions): Promise<ExportedGroup[]> {
	const { page, request, course, log = () => undefined } = options;
	await page.goto(`${canvasCourseUrl(course.url) || safeCanvasUrl(course.url)}/modules`, { waitUntil: 'domcontentloaded' });
	const selected = await getCanvasModuleGroups(page, options.groupMatches || []);
	if (!selected.length) {
		log(`no matching module groups found for ${course.title}; skipping`);
		return [];
	}
	log(`discovered ${selected.length} module groups in ${course.title}`);
	const exported: ExportedGroup[] = [];
	for (const group of selected) exported.push(await scrapeCanvasGroup({ page, request, course, group, output: path.resolve(options.output), log }));
	return exported;
}

/**
 * Validates and sanitizes the Canvas origin URL used by an export.
 *
 * @param value - User-supplied Canvas URL.
 *
 * @return HTTP or HTTPS URL without credentials, query parameters, or fragment data.
 */
export function normalizeCanvasUrl(value: string): string {
	const url = new URL(value);
	if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Canvas URL must use HTTP or HTTPS.');
	url.username = '';
	url.password = '';
	url.search = '';
	url.hash = '';
	return url.href;
}

/**
 * Checks whether the current page exposes Canvas course or module content.
 *
 * @param page - Playwright page opened at the configured Canvas URL.
 *
 * @return `true` when the page is authenticated and has usable course content.
 */
export async function isCanvasReady(page: Page): Promise<boolean> {
	if (/\/(?:login|saml|auth)(?:\/|$)/i.test(new URL(page.url()).pathname)) return false;
	if (
		await page
			.locator('#context_modules')
			.isVisible({ timeout: 1_000 })
			.catch(() => false)
	)
		return true;
	if (
		await page
			.locator('.ic-DashboardCard__link[href], .ic-DashboardCard a[href], a[href="/courses"], a[href^="/courses?"]')
			.first()
			.isVisible({ timeout: 1_000 })
			.catch(() => false)
	)
		return true;
	const course = canvasCourseUrl(page.url());
	if (!course) return false;
	await page.goto(`${course}/modules`, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
	return page
		.locator('#context_modules')
		.isVisible({ timeout: 5_000 })
		.catch(() => false);
}

/**
 * Runs a complete local export using a visible or headless authenticated browser context.
 *
 * @param options - Canvas source URL, browser mode, course filters, output, and logger.
 *
 * @return Written export directory, manifest data, and sanitized log messages.
 */
export async function scrapeCanvas(options: CanvasScrapeOptions): Promise<CanvasScrapeResult> {
	const source = normalizeCanvasUrl(options.canvasUrl);
	const output = path.resolve(options.output || path.join(os.homedir(), 'Downloads', 'canvas-export'));
	const headed = options.headed || false;
	const logs: string[] = [];
	/**
	 * Records one sanitized progress or error message for the export.
	 *
	 * @param message - Progress or error text before URL sanitization.
	 * @param failure - Whether this message represents an export failure.
	 */
	const log = (message: string, failure = false): void => {
		const line = '[canvas-export] ' + sMessage(message);
		logs.push(line);
		(options.log || ((value: string, isFailure?: boolean) => (isFailure ? console.error(value) : console.log(value))))(line, failure);
	};
	let session: Awaited<ReturnType<typeof authenticateWorkflow<Page>>> | undefined;
	try {
		log('starting download export from ' + safeCanvasUrl(source));
		session = await authenticateWorkflow<Page>({
			sessionName: 'canvas',
			storageStatePath: path.resolve(options.storageStatePath || resolveWorkflowStorageStatePath('canvas')),
			headed,
			interactive: options.interactive ?? headed,
			timeoutMs: 15 * 60_000,
			open: async (context) => {
				const page = await context.newPage();
				await page.goto(source, { waitUntil: 'domcontentloaded' });
				const directCourse = canvasCourseUrl(source);
				if (directCourse) await page.goto(directCourse + '/modules', { waitUntil: 'domcontentloaded' });
				return page;
			},
			isReady: isCanvasReady,
			onInteractiveStart: () => log('complete Canvas sign-in in the opened browser; session state is stored outside this repository'),
			authenticationRequiredMessage: 'Canvas sign-in is required. Rerun with --headed to sign in through a visible browser.',
		});
		const page = session.value;
		const direct = canvasCourseUrl(source);
		const courses = direct
			? [{ title: 'Course ' + direct.split('/').at(-1), url: direct }]
			: await discoverCanvasCourses(page, source, {
					includeAllCourses: options.includeAllCourses,
					dashboardScope: new URL(source).pathname === '/' || /\/dashboard\/?$/.test(new URL(source).pathname),
				});
		if (!courses.length) throw new Error('No matching Canvas courses were found at ' + safeCanvasUrl(source) + '.');
		log('discovered ' + courses.length + ' Canvas courses');
		const manifest: CanvasExportManifest = { source: safeCanvasUrl(source), mode: 'download', courses: [], groups: [] };
		for (const course of courses) {
			const groups = await scrapeCanvasCourse({ page, request: session.context.request, course, output, groupMatches: options.groupMatches, log });
			manifest.courses.push({ title: course.title, url: safeCanvasUrl(course.url), groups: groups.map((group) => group.title) });
			manifest.groups.push(...groups);
		}
		await mkdir(output, { recursive: true });
		await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
		log('download export complete: ' + manifest.groups.length + ' module groups written to ' + output);
		await writeFile(path.join(output, 'canvas-export.log'), logs.join('\n') + '\n');
		return { output, manifest, logs };
	} catch (err) {
		const message = sMessage(err instanceof Error ? err.message : err);
		log(message, true);
		await mkdir(output, { recursive: true }).catch(() => undefined);
		await writeFile(path.join(output, 'canvas-export.log'), logs.join('\n') + '\n').catch(() => undefined);
		throw new Error(message, { cause: err });
	} finally {
		await session?.close();
	}
}
