import { access, chmod, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium, type APIRequestContext, type BrowserContext, type Page } from 'playwright';

export type CanvasItem = { title: string; url: string; type: 'file' | 'page' | 'link' };
export type CanvasCourse = { title: string; url: string };
export type CanvasGroup = { title: string; items: CanvasItem[] };
export type CanvasFile = { path: string; name: string; sourceUrl?: string };
export type ExportedGroup = {
	course: CanvasCourse;
	title: string;
	files: CanvasFile[];
	textPath: string;
	links: string[];
	text: string;
	errors: string[];
};
export type CanvasExportManifest = {
	source: string;
	mode: 'download';
	courses: { title: string; url: string; groups: string[] }[];
	groups: ExportedGroup[];
};
export type CanvasScrapeOptions = {
	canvasUrl: string;
	output?: string;
	groupMatches?: string[];
	storageStatePath?: string;
	headed?: boolean;
	includeAllCourses?: boolean;
	log?: (message: string, failure?: boolean) => void;
};
export type CanvasScrapeResult = { output: string; manifest: CanvasExportManifest; logs: string[] };
export type ScrapeCanvasCourseOptions = {
	page: Page;
	request: APIRequestContext;
	course: CanvasCourse;
	output: string;
	groupMatches?: string[];
	log?: (message: string, failure?: boolean) => void;
};

const IMAGE_EXTENSIONS = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp']);
const TEXT_EXTENSIONS = new Set([
	'.asm', '.bat', '.c', '.cc', '.conf', '.cpp', '.css', '.cxx', '.def', '.diff', '.eml', '.graphql', '.h', '.hh', '.htm', '.html', '.ics',
	'.ifb', '.ini', '.java', '.js', '.json', '.ksh', '.list', '.log', '.mht', '.mhtml', '.md', '.markdown', '.mjs', '.patch', '.pl',
	'.properties', '.py', '.rst', '.s', '.sh', '.sql', '.srt', '.text', '.toml', '.ts', '.tsx', '.tsv', '.txt', '.vcf', '.vtt', '.xml',
	'.yaml', '.yml',
]);
const SEMESTER_TITLE = /\b(?:(?:autumn|spring|summer|winter)\s+\d{4}|\d{4}\s+(?:autumn|spring|summer|winter)|(?:semester|term)\s+\d{1,2}\s+\d{4}|\d{4}\s+(?:semester|term)\s+\d{1,2})\b/i;

/** Removes credentials, query parameters, and fragments before a source URL is recorded. */
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

/** Converts a course file URL into its stable Canvas file URL. */
export function canvasFileUrl(value: string): string | undefined {
	try {
		const url = new URL(value);
		const match = url.pathname.match(/^\/courses\/(\d+)\/files\/(\d+)(?:\/|$)/);
		return match ? `${url.origin}/courses/${match[1]}/files/${match[2]}` : undefined;
	} catch {
		return undefined;
	}
}

/** Returns Canvas's authenticated file-download endpoint for a course file URL. */
export function canvasFileDownloadUrl(value: string): string | undefined {
	const base = canvasFileUrl(value);
	return base ? `${base}/download?download_frd=1` : undefined;
}

/** Produces the stable identity used to match Canvas source routes across imports. */
export function canvasSourceKey(value: string): string {
	const url = new URL(value);
	const fragment = decodeURIComponent(url.hash.replace(/^#/, '')).trim().toLowerCase();
	const segments = url.pathname.split('/');
	while (segments.length > 1 && segments.at(-1) === '') segments.pop();
	return `${url.origin.toLowerCase()}${segments.join('/') || '/'}${fragment ? `#${fragment}` : ''}`;
}

/** Detects a Canvas HTML preview that was returned in place of attachment bytes. */
export function isCanvasPreviewBody(body: Buffer, contentType: string): boolean {
	if (!/html/i.test(contentType)) return false;
	const head = body.subarray(0, 200_000).toString('utf8');
	return /<html\b/i.test(head) && /ic-Layout|data-attachment_name|id=["']application["']/i.test(head);
}

/** Returns a canonical course URL when the supplied URL is scoped to one Canvas course. */
export function canvasCourseUrl(value: string): string | undefined {
	try {
		const url = new URL(value);
		const match = url.pathname.match(/^\/courses\/(\d+)(?:\/|$)/);
		return match ? `${url.origin}/courses/${match[1]}` : undefined;
	} catch {
		return undefined;
	}
}

function safeMessage(value: unknown): string {
	return String(value).replace(/https?:\/\/[^\s"'<>]+/g, (candidate) => safeCanvasUrl(candidate));
}

function safeName(value: string): string {
	const result = value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/gi, '-')
		.replace(/^-+|-+$/g, '')
		.toLowerCase()
		.slice(0, 120)
		.replace(/-+$/g, '');
	return result || 'resource';
}

function safeFileName(value: string): string {
	const normalized = path.basename(value.replaceAll('\\', '/'));
	const extension = path.extname(normalized).toLowerCase();
	const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
	const stem = safeExtension ? normalized.slice(0, -safeExtension.length) : normalized;
	return `${safeName(stem)}${safeExtension}`;
}

function inferredFileName(fileName: string, contentType: string): string {
	const mime = contentType.toLowerCase().split(';')[0].trim();
	const binaryExtension: Record<string, string> = {
		'application/pdf': '.pdf',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
		'image/gif': '.gif',
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/webp': '.webp',
	};
	const extension = path.extname(fileName).toLowerCase();
	const inferred = binaryExtension[mime];
	if (inferred) return extension === inferred ? fileName : extension ? `${fileName.slice(0, -extension.length)}${inferred}` : `${fileName}${inferred}`;
	if (extension && (TEXT_EXTENSIONS.has(extension) || IMAGE_EXTENSIONS.has(extension) || ['.pdf', '.docx', '.pptx'].includes(extension))) return fileName;
	const textExtension = ({ 'application/json': '.json', 'application/x-ndjson': '.json' } as Record<string, string>)[mime] || (mime.startsWith('text/') ? '.txt' : '');
	if (textExtension && extension) return `${fileName.slice(0, -extension.length)}${textExtension}`;
	if (textExtension) return `${fileName}${textExtension}`;
	if (extension && !TEXT_EXTENSIONS.has(extension) && /^(?:text\/|application\/(?:json|x-ndjson))/.test(mime)) return `${fileName.slice(0, -extension.length)}.txt`;
	return fileName;
}

function responseFileName(header?: string): string | undefined {
	if (!header) return undefined;
	const encoded = header.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i)?.[1]?.trim().replace(/^"|"$/g, '');
	if (encoded) {
		try {
			return decodeURIComponent(encoded);
		} catch {
			return encoded;
		}
	}
	return header.match(/filename\s*=\s*"?([^";]+)/i)?.[1]?.trim();
}

async function canvasDownload(request: APIRequestContext, value: string) {
	let response = await request.get(canvasFileDownloadUrl(value) || value, { timeout: 60_000 });
	const resolvedDownload = canvasFileDownloadUrl(response.url());
	if (resolvedDownload && resolvedDownload !== response.url()) {
		await response.dispose();
		response = await request.get(resolvedDownload, { timeout: 60_000 });
	}
	return response;
}

/** Discovers courses exposed by the current dashboard or course list. */
export async function discoverCanvasCourses(
	page: Page,
	initialUrl: string,
	options: { includeAllCourses?: boolean; dashboardScope?: boolean } = {},
): Promise<CanvasCourse[]> {
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
	const currentPath = new URL(page.url()).pathname;
	if (!found.length && options.dashboardScope) return [];
	if (!found.length && !/^\/courses(?:\/|$)/.test(currentPath)) {
		await page.goto(new URL('/courses', initialUrl).href, { waitUntil: 'domcontentloaded' });
		await page.waitForLoadState('networkidle').catch(() => undefined);
		found = await collect('a[href]');
	}
	const unique = [...new Map(found.map((course) => [course.url, course])).values()];
	return unique.filter((course) => options.includeAllCourses || SEMESTER_TITLE.test(course.title));
}

/** Reads and classifies the module groups currently visible on a Canvas course page. */
export async function getCanvasModuleGroups(page: Page, matches: string[] = []): Promise<CanvasGroup[]> {
	await page.locator('#context_modules').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
	const found = await page.locator('#context_modules .context_module').evaluateAll((nodes) =>
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
		items: group.items.map((item) => ({
			title: item.title,
			url: item.url,
			type: /attachment|file/i.test(item.label)
				? 'file'
				: /page/i.test(item.label) || /\/courses\/\d+\/pages\//.test(item.url)
					? 'page'
					: /\/files\/|download(?:\?|$)/.test(item.url)
						? 'file'
						: 'link',
		})),
	}));
}

async function pageContent(page: Page, item: CanvasItem): Promise<{ text: string; files: CanvasItem[] }> {
	await page.goto(item.url, { waitUntil: 'domcontentloaded' });
	await page.waitForURL((url) => !url.pathname.includes('/modules/items/'), { timeout: 30_000 }).catch(() => undefined);
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page
		.waitForFunction(
			() => ['#content', '#wiki_page_show .show-content', '.show-content', 'main'].some((selector) => [...document.querySelectorAll(selector)].some((element) => element.textContent?.trim())),
			null,
			{ timeout: 30_000 },
		)
		.catch(() => undefined);
	const bodyText = await page.evaluate(() =>
		['#content', '#wiki_page_show .show-content', '.show-content', 'main']
			.flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)])
			.filter((element) => element.textContent?.trim() && element.getBoundingClientRect().height > 0)
			.sort((left, right) => (right.innerText?.length || 0) - (left.innerText?.length || 0))[0]
			?.innerText.trim() || '',
	);
	if (!bodyText) throw new Error(`Canvas page returned no readable content after redirect to ${safeCanvasUrl(page.url())}.`);
	const links = await page
		.locator('#content, #wiki_page_show .show-content, .show-content, main')
		.first()
		.locator('a[href]')
		.evaluateAll((nodes) => nodes.map((node) => ({ title: node.textContent?.trim() || '', url: (node as HTMLAnchorElement).href })));
	const seen = new Set<string>();
	const files = links.flatMap((link) => {
		const fileUrl = canvasFileUrl(link.url);
		if (!fileUrl || seen.has(fileUrl)) return [];
		seen.add(fileUrl);
		return [{ title: link.title || 'Untitled file', url: link.url, type: 'file' as const }];
	});
	return { text: `${item.title}\n${safeCanvasUrl(item.url)}\n\n${bodyText}`, files };
}

/** Scrapes one authenticated Canvas module group and writes its source files locally. */
export async function scrapeCanvasGroup(options: {
	page: Page;
	request: APIRequestContext;
	course: CanvasCourse;
	group: CanvasGroup;
	output: string;
	log?: (message: string, failure?: boolean) => void;
}): Promise<ExportedGroup> {
	const { page, request, course, group, log = () => undefined } = options;
	const output = path.resolve(options.output);
	const folder = path.join(output, safeName(course.title), safeName(group.title));
	await mkdir(folder, { recursive: true });
	log(`staging ${course.title} / ${group.title} (${group.items.length} module items)`);
	const record: ExportedGroup = {
		course: { title: course.title, url: safeCanvasUrl(course.url) },
		title: group.title,
		files: [],
		textPath: '',
		links: [],
		text: '',
		errors: [],
	};
	const items = [...new Map(group.items.map((item) => [item.url, item])).values()];
	const downloaded = new Set<string>();
	for (let index = 0; index < items.length; index++) {
		const item = items[index];
		try {
			if (item.type === 'page') {
				log(`reading page ${item.title}`);
				const content = await pageContent(page, item);
				record.text += `${record.text ? '\n\n---\n\n' : ''}${content.text}`;
				items.push(...content.files);
			} else if (item.type === 'file') {
				const source = canvasFileUrl(item.url);
				const identity = source || safeCanvasUrl(item.url);
				if (downloaded.has(identity)) continue;
				downloaded.add(identity);
				log(`downloading ${item.title}`);
				const response = await canvasDownload(request, item.url);
				try {
					if (!response.ok()) throw new Error(`download returned HTTP ${response.status()}`);
					const headers = response.headers();
					const fileName = responseFileName(headers['content-disposition']) || item.title;
					const diskName = safeFileName(inferredFileName(fileName, headers['content-type'] || ''));
					const fileId = (source || canvasFileUrl(response.url()))?.split('/').at(-1) || safeName(fileName);
					const filePath = path.join(folder, `${safeName(fileId)}-${diskName}`);
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
		} catch (error) {
			const message = `${item.title}: ${safeMessage(error instanceof Error ? error.message : error)}`;
			record.errors.push(message);
			log(message, true);
		}
	}
	const textPath = path.join(folder, `${safeName(group.title)}.txt`);
	await writeFile(textPath, record.text);
	record.textPath = textPath;
	record.files.unshift({ path: textPath, name: path.basename(textPath) });
	return record;
}

/** Scrapes all selected module groups from one authenticated Canvas course. */
export async function scrapeCanvasCourse(options: ScrapeCanvasCourseOptions): Promise<ExportedGroup[]> {
	const { page, request, course, log = () => undefined } = options;
	const output = path.resolve(options.output);
	await page.goto(`${canvasCourseUrl(course.url) || safeCanvasUrl(course.url)}/modules`, { waitUntil: 'domcontentloaded' });
	const selected = await getCanvasModuleGroups(page, options.groupMatches || []);
	if (!selected.length) {
		log(`no matching module groups found for ${course.title}; skipping`);
		return [];
	}
	log(`discovered ${selected.length} module groups in ${course.title}`);
	const exported: ExportedGroup[] = [];
	for (const group of selected) exported.push(await scrapeCanvasGroup({ page, request, course, group, output, log }));
	return exported;
}

function defaultStorageStatePath(): string {
	return process.platform === 'darwin'
		? path.join(os.homedir(), 'Library', 'Application Support', 'Terra Symposium', 'canvas-storage-state.json')
		: path.join(os.homedir(), '.config', 'terra-symposium', 'canvas-storage-state.json');
}

function normalizeCanvasUrl(value: string): string {
	const url = new URL(value);
	if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Canvas URL must use HTTP or HTTPS.');
	url.username = '';
	url.password = '';
	url.search = '';
	url.hash = '';
	return url.href;
}

async function isCanvasReady(page: Page): Promise<boolean> {
	if (/\/(?:login|saml|auth)(?:\/|$)/i.test(new URL(page.url()).pathname)) return false;
	if (await page.locator('#context_modules').isVisible({ timeout: 1_000 }).catch(() => false)) return true;
	if (
		await page
			.locator('.ic-DashboardCard__link[href], .ic-DashboardCard a[href], a[href="/courses"], a[href^="/courses?"]')
			.first()
			.isVisible({ timeout: 1_000 })
			.catch(() => false)
	) return true;
	const course = canvasCourseUrl(page.url());
	if (!course) return false;
	await page.goto(`${course}/modules`, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
	return page.locator('#context_modules').isVisible({ timeout: 5_000 }).catch(() => false);
}

async function waitForCanvasReady(page: Page): Promise<void> {
	const deadline = Date.now() + 15 * 60_000;
	while (Date.now() < deadline) {
		if (await isCanvasReady(page)) return;
		await page.waitForTimeout(1_000);
	}
	throw new Error('Canvas access was not ready within 15 minutes.');
}

/** Runs a complete local export using a visible or headless authenticated browser context. */
export async function scrapeCanvas(options: CanvasScrapeOptions): Promise<CanvasScrapeResult> {
	const source = normalizeCanvasUrl(options.canvasUrl);
	const output = path.resolve(options.output || path.join(os.homedir(), 'Downloads', 'canvas-export'));
	const storageStatePath = path.resolve(options.storageStatePath || defaultStorageStatePath());
	const headed = options.headed || false;
	const logs: string[] = [];
	const log = (message: string, failure = false): void => {
		const line = `[canvas-export] ${safeMessage(message)}`;
		logs.push(line);
		(options.log || ((value: string, isFailure?: boolean) => (isFailure ? console.error(value) : console.log(value))))(line, failure);
	};
	let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
	let context: BrowserContext | undefined;
	try {
		log(`starting download export from ${safeCanvasUrl(source)}`);
		browser = await chromium.launch({ headless: !headed });
		const hasState = await access(storageStatePath).then(() => true).catch(() => false);
		context = await browser.newContext(hasState ? { storageState: storageStatePath } : {});
		const page = await context.newPage();
		await page.goto(source, { waitUntil: 'domcontentloaded' });
		const directCourse = canvasCourseUrl(source);
		if (directCourse) await page.goto(`${directCourse}/modules`, { waitUntil: 'domcontentloaded' });
		if (!(await isCanvasReady(page))) {
			if (!headed) throw new Error('Canvas sign-in is required. Rerun with --headed to sign in through the visible browser.');
			log('complete Canvas sign-in in the opened browser; session state is stored outside this repository');
			await waitForCanvasReady(page);
		}
		await mkdir(path.dirname(storageStatePath), { recursive: true, mode: 0o700 });
		await context.storageState({ path: storageStatePath });
		await chmod(storageStatePath, 0o600).catch(() => undefined);
		const direct = canvasCourseUrl(source);
		const courses = direct
			? [{ title: `Course ${direct.split('/').at(-1)}`, url: direct }]
			: await discoverCanvasCourses(page, source, {
					includeAllCourses: options.includeAllCourses,
					dashboardScope: new URL(source).pathname === '/' || /\/dashboard\/?$/.test(new URL(source).pathname),
				});
		if (!courses.length) throw new Error(`No matching Canvas courses were found at ${safeCanvasUrl(source)}.`);
		log(`discovered ${courses.length} Canvas courses`);
		const manifest: CanvasExportManifest = { source: safeCanvasUrl(source), mode: 'download', courses: [], groups: [] };
		for (const course of courses) {
			const groups = await scrapeCanvasCourse({
				page,
				request: context.request,
				course,
				output,
				groupMatches: options.groupMatches,
				log,
			});
			manifest.courses.push({ title: course.title, url: safeCanvasUrl(course.url), groups: groups.map((group) => group.title) });
			manifest.groups.push(...groups);
		}
		await mkdir(output, { recursive: true });
		await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
		log(`download export complete: ${manifest.groups.length} module groups written to ${output}`);
		await writeFile(path.join(output, 'canvas-export.log'), `${logs.join('\n')}\n`);
		return { output, manifest, logs };
	} catch (error) {
		const message = safeMessage(error instanceof Error ? error.message : error);
		log(message, true);
		await mkdir(output, { recursive: true }).catch(() => undefined);
		await writeFile(path.join(output, 'canvas-export.log'), `${logs.join('\n')}\n`).catch(() => undefined);
		throw new Error(message, { cause: error });
	} finally {
		await context?.close().catch(() => undefined);
		await browser?.close().catch(() => undefined);
	}
}
