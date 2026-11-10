#!/usr/bin/env node
/**
 * Inventory locally collected Canvas/Zoom/Kaltura transcripts by course week.
 * This helper never opens a browser, fetches remote content, or changes Docs.
 */

/*//////////////////////////////////////////////////
IMPORTS
//////////////////////////////////////////////////*/

// API
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

/*//////////////////////////////////////////////////
TYPES
//////////////////////////////////////////////////*/

/** Metadata allowlist supported by one explicit transcript source mapping.
 * @typedef {Record<string, unknown> & {week?: number|string, recordingUrl?: string, meetingTitle?: string, meetingDate?: string, platform?: string, captureMethod?: string, transcriptOrigin?: string, language?: string, visibleVerification?: string, captionStatus?: string, expectedIds?: string[]}} MappingRecord
 */
/** One expected transcript source used by the coverage report.
 * @typedef {{id: string, week: number|string, title?: string, required?: boolean, matchAny?: string[], expectedIds?: string[]}} ExpectedMeeting
 */
/** One local transcript and the provenance used to classify it.
 * @typedef {{week: number|undefined, weekMethod: string, inferredWeeks: number[], name: string, source: string, extension: string, sha256: string, bytes: number, text: string, metadata: Record<string, unknown>, provenanceStatus: string, mappingMatch: string}} TranscriptEntry
 */

/*//////////////////////////////////////////////////
CONFIG
//////////////////////////////////////////////////*/

/**
 * Reads one named command-line option from the process arguments.
 *
 * @param {string} name - Option name without its leading dashes.
 *
 * @return {string|undefined} Option value when the caller supplied it.
 */
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
	console.log('Usage: canvas-transcripts --input=EXPORT_DIR --output=TRANSCRIPT_DIR [--weeks=12] [--mapping=SOURCE_MAP.json] [--expected=EXPECTED_MEETINGS.json]');
	process.exit(0);
}
const value = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const inputArg = value('input');
const outputArg = value('output');
const weeks = Number(value('weeks') || 12);
const inputRoot = path.resolve(inputArg || '.');
const outputRoot = path.resolve(outputArg || '.');
const mappingArg = value('mapping');
const expectedArg = value('expected');
/** Transcript records collected from valid source files.
 * @type {TranscriptEntry[]} - Sorted before writing the final week manifest.
 */
const entries = [];
/** Source paths that could not be assigned a trusted week or mapping.
 * @type {Record<string, unknown>[]} - Includes ambiguity and range diagnostics.
 */
const unmatchedSources = [];
/** Read failures encountered while processing local transcript files.
 * @type {{source: string, message: string}[]} - Stores source-relative paths and safe messages.
 */
const readErrs = [];
const mappingInput = await readJson(mappingArg, 'source mapping');
const rawMapping = mappingInput.value;
const rawMappingRecord = isRecord(rawMapping) ? rawMapping : undefined;
const mappingObjectValue = (rawMappingRecord && rawMappingRecord.sources) || rawMapping || {};
/** Explicit path-to-metadata mappings loaded from the source map.
 * @type {Map<string, MappingRecord>} - Keys are normalized relative paths.
 */
const mappingByPath = new Map();
/** Basename mappings used only when a filename is unique.
 * @type {Map<string, MappingRecord[]>} - Multiple entries stay ambiguous for review.
 */
const mappingByBaseName = new Map();
const expectedInput = await readJson(expectedArg, 'expected-meetings');
const expectedMeetings = /** @type {unknown[]} */ ((isRecord(expectedInput.value) && expectedInput.value.meetings) || []);
if (
	!Array.isArray(expectedMeetings) ||
	!expectedMeetings.every(
		(meeting) =>
			isRecord(meeting) &&
			typeof meeting.id === 'string' &&
			(typeof meeting.week === 'number' || typeof meeting.week === 'string') &&
			Number.isInteger(Number(meeting.week)) &&
			Number(meeting.week) >= 1 &&
			(meeting.title === undefined || typeof meeting.title === 'string') &&
			(meeting.required === undefined || typeof meeting.required === 'boolean') &&
			['matchAny', 'expectedIds'].every((key) => meeting[key] === undefined || (Array.isArray(meeting[key]) && meeting[key].every((i) => typeof i === 'string'))),
	)
) {
	throw new Error('Expected-meetings JSON must contain valid meeting records.');
}
/** Transcript entries grouped by their resolved week number.
 * @type {Map<number, TranscriptEntry[]>} - Unresolved sources remain in diagnostics only.
 */
const grouped = new Map();

const report = [];
const manifest = {
	inputDirectoryName: path.basename(inputRoot),
	outputDirectoryName: path.basename(outputRoot),
	expectedWeeks: weeks,
	options: {
		mapping: mappingArg && mappingInput.name ? { file: mappingInput.name, sha256: mappingInput.sha256 } : null,
		expected: expectedArg && expectedInput.name ? { file: expectedInput.name, sha256: expectedInput.sha256 } : null,
	},
	transcriptFileCount: entries.length,
	unmatchedSources,
	readErrors: readErrs,
	missingExpectedMeetings: [],
	weeks: report,
};

/*//////////////////////////////////////////////////
HELPERS
//////////////////////////////////////////////////*/

/**
 * Checks whether an unknown value is an object with named fields.
 *
 * @param {unknown} value - Value to inspect.
 *
 * @return {value is Record<string, unknown>} Whether the value is a non-array object.
 */
function isRecord(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Computes a stable SHA-256 digest for transcript input bytes.
 *
 * @param {Uint8Array|string} bytes - Transcript or manifest contents.
 *
 * @return {string} Lowercase hexadecimal digest.
 */
function hash(bytes) {
	return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Normalizes a source path for matching against the explicit mapping file.
 *
 * @param {unknown} value - Candidate path or name from source metadata.
 *
 * @return {string} Lowercase slash-separated lookup key.
 */
function normLookup(value) {
	return String(value).replaceAll('\\', '/').replace(/^\.\//, '').toLocaleLowerCase();
}

/**
 * Removes punctuation and case differences before expected-meeting matching.
 *
 * @param {unknown} value - Source name, title, or configured meeting identifier.
 *
 * @return {string} Alphanumeric lowercase matching token.
 */
function normMatch(value) {
	return String(value)
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Reads and hashes an optional JSON input file without retaining its path in the report.
 *
 * @param {string|undefined} arg - Path supplied by the corresponding command-line option.
 * @param {string} label - Human-readable input label for sanitized error messages.
 *
 * @return {Promise<{value: unknown, name: string|undefined, sha256: string|undefined}>} Parsed value and file provenance.
 */
async function readJson(arg, label) {
	if (!arg) return { value: undefined, name: undefined, sha256: undefined };
	const fullPath = path.resolve(arg);
	try {
		const bytes = await readFile(fullPath);
		return { value: JSON.parse(bytes.toString('utf8')), name: path.basename(fullPath), sha256: hash(bytes) };
	} catch (err) {
		throw new Error(`Could not read ${label} JSON ${path.basename(fullPath)}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
	}
}

if (!inputArg || !outputArg || !Number.isInteger(weeks) || weeks < 1) {
	console.error('Usage: canvas-transcripts --input=EXPORT_DIR --output=TRANSCRIPT_DIR [--weeks=12] [--mapping=SOURCE_MAP.json] [--expected=EXPECTED_MEETINGS.json]');
	process.exit(2);
}
if (inputRoot === outputRoot) throw new Error('Input and output directories must differ.');
await mkdir(outputRoot, { recursive: true });
if (!isRecord(mappingObjectValue)) throw new Error('Source mapping must be an object keyed by source-relative path or filename.');
for (const [key, rawRecord] of Object.entries(mappingObjectValue)) {
	if (
		!isRecord(rawRecord) ||
		(rawRecord.week !== undefined && typeof rawRecord.week !== 'string' && typeof rawRecord.week !== 'number') ||
		!['recordingUrl', 'meetingTitle', 'meetingDate', 'platform', 'captureMethod', 'transcriptOrigin', 'language', 'visibleVerification', 'captionStatus'].every(
			(field) => rawRecord[field] === undefined || typeof rawRecord[field] === 'string',
		) ||
		(rawRecord.expectedIds !== undefined && (!Array.isArray(rawRecord.expectedIds) || !rawRecord.expectedIds.every((id) => typeof id === 'string')))
	) {
		continue;
	}
	const record = /** @type {MappingRecord} */ (rawRecord);
	const normKey = normLookup(key);
	mappingByPath.set(normKey, record);
	const baseName = path.posix.basename(normKey);
	mappingByBaseName.set(baseName, [...(mappingByBaseName.get(baseName) || []), record]);
}
const pendingDirs = [{ directory: inputRoot, entries: await readdir(inputRoot, { withFileTypes: true }), index: 0 }];
while (pendingDirs.length) {
	const current = pendingDirs[pendingDirs.length - 1];
	if (current.index >= current.entries.length) {
		pendingDirs.pop();
		continue;
	}
	const entry = current.entries[current.index++];
	const full = path.join(current.directory, entry.name);
	const outputRelativePath = path.relative(outputRoot, full);
	if (outputRelativePath === '' || (!outputRelativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(outputRelativePath))) continue;
	if (entry.isDirectory()) {
		pendingDirs.push({ directory: full, entries: await readdir(full, { withFileTypes: true }), index: 0 });
		continue;
	}
	const ext = path.extname(entry.name).toLowerCase();
	if (!['.txt', '.vtt', '.srt'].includes(ext)) continue;
	const source = path.relative(inputRoot, full).split(path.sep).join('/');
	const normSource = normLookup(source);
	const basename = path.posix.basename(normSource);
	const basenameRecords = mappingByBaseName.get(basename) || [];
	const mapping = mappingByPath.has(normSource)
		? { record: mappingByPath.get(normSource), key: normSource, match: 'relative-path' }
		: basenameRecords.length === 1
			? { record: basenameRecords[0], key: basename, match: 'unique-basename' }
			: basenameRecords.length > 1
				? { record: undefined, key: basename, match: 'ambiguous-basename' }
				: { record: undefined, key: undefined, match: 'none' };
	if (mapping.match === 'ambiguous-basename') unmatchedSources.push({ source, reason: 'ambiguous-mapping-basename', mappingKey: mapping.key });
	if (!mapping.record && ext !== '.vtt' && ext !== '.srt' && !/(transcript|caption|subtitle|lecture|recording|zoom|kaltura|machine[-_ ]transcribed)/i.test(source)) continue;
	const candidates = new Set();
	for (const pattern of [
		/\bweek[\s._/-]*0*(\d{1,2})(?!\d)/gi,
		/(?:^|[^a-z0-9])(?:wk|w)[\s._-]*0*(\d{1,2})(?!\d)/gi,
		/\b(?:lecture|session)[\s._-]*0*(\d{1,2})(?!\d)/gi,
		/(?:^|[/\\])0*(\d{1,2})[\s._-]*(?:lecture|session|recording|transcript|caption)\b/gi,
	]) {
		for (const match of source.matchAll(pattern)) candidates.add(Number(match[1]));
	}
	const inferredWeeks = [...candidates].sort((left, right) => left - right);
	const mappedWeek = Number(mapping.record?.week);
	const week = Number.isInteger(mappedWeek) && mappedWeek > 0 ? mappedWeek : inferredWeeks.length === 1 ? inferredWeeks[0] : undefined;
	if (week && week > weeks) {
		unmatchedSources.push({ source, reason: 'week-outside-requested-range', week, inferredWeeks });
		continue;
	}

	/** Bytes read from one candidate transcript file.
	 * @type {Buffer} - Kept only long enough to hash and decode the local file.
	 */
	let bytes;
	try {
		bytes = await readFile(full);
	} catch (err) {
		readErrs.push({ source, message: err instanceof Error ? err.message : String(err) });
		unmatchedSources.push({ source, reason: 'read-error' });
		continue;
	}
	/** Approved provenance fields copied to a report entry.
	 * @type {Record<string, unknown>} - Contains only values from the explicit metadata allowlist.
	 */
	const metadata = {};
	for (const field of ['week', 'meetingTitle', 'meetingDate', 'platform', 'captureMethod', 'transcriptOrigin', 'language', 'visibleVerification', 'captionStatus', 'expectedIds']) {
		const item = mapping.record?.[field];
		if (item !== undefined && item !== null && item !== '') metadata[field] = item;
	}
	if (typeof mapping.record?.recordingUrl === 'string' && mapping.record.recordingUrl) {
		try {
			const url = new URL(mapping.record.recordingUrl);
			url.username = '';
			url.password = '';
			url.search = '';
			url.hash = '';
			metadata.recordingUrl = url.toString();
		} catch {
			// Invalid mapping URLs are omitted from provenance metadata.
		}
	}
	entries.push({
		week,
		weekMethod: Number.isInteger(mappedWeek) && mappedWeek > 0 ? 'manual-mapping' : inferredWeeks.length === 1 ? 'path-pattern' : 'unresolved',
		inferredWeeks,
		name: entry.name,
		source,
		extension: ext,
		sha256: hash(bytes),
		bytes: bytes.byteLength,
		text: bytes.toString('utf8'),
		metadata,
		provenanceStatus: metadata.platform && (metadata.captureMethod || metadata.transcriptOrigin) ? 'recorded' : 'incomplete-or-unknown',
		mappingMatch: mapping.match,
	});
	if (!week) unmatchedSources.push({ source, reason: inferredWeeks.length > 1 ? 'ambiguous-week-patterns' : 'week-not-determined', inferredWeeks, mappingMatch: mapping.match });
}
const expectedReportEntries = expectedMeetings.map((rawMeeting) => {
	const meeting = /** @type {ExpectedMeeting} */ (rawMeeting);
	const week = Number(meeting.week);
	const matched = entries.filter((entry) =>
		[...(Array.isArray(meeting.matchAny) ? meeting.matchAny : []), ...(Array.isArray(meeting.expectedIds) ? meeting.expectedIds : []), meeting.id]
			.map(normMatch)
			.filter(Boolean)
			.some((token) =>
				[
					entry.source,
					entry.name,
					entry.metadata.meetingTitle,
					...(Array.isArray(entry.metadata.expectedIds) && entry.metadata.expectedIds.every((id) => typeof id === 'string') ? entry.metadata.expectedIds : []),
				]
					.filter(Boolean)
					.map(normMatch)
					.some((value) => value.includes(token)),
			),
	);
	return {
		id: meeting.id,
		week,
		title: meeting.title || meeting.id,
		required: meeting.required !== false,
		status: matched.some((entry) => entry.week === week)
			? 'found'
			: matched.some((entry) => Number.isInteger(entry.week) && entry.week !== week)
				? 'wrong-week'
				: matched.length
					? 'unassigned-week'
					: 'missing',
		matchedSources: matched.map((entry) => ({ source: entry.source, week: entry.week ?? null, sha256: entry.sha256 })),
	};
});
manifest.transcriptFileCount = entries.length;
manifest.missingExpectedMeetings = expectedReportEntries.filter((i) => i.required && i.status !== 'found');
entries.sort((a, b) => a.source.localeCompare(b.source));
for (const entry of entries) {
	if (!entry.week) continue;
	grouped.set(entry.week, [...(grouped.get(entry.week) || []), entry]);
}
for (let week = 1; week <= weeks; week++) {
	const files = grouped.get(week) || [];
	const unique = [];
	const seen = new Set();
	for (const file of files) {
		if (seen.has(file.sha256)) continue;
		seen.add(file.sha256);
		unique.push(file);
	}
	const primarySource = new Map(unique.map((file) => [file.sha256, file.source]));
	const expectedForWeek = expectedReportEntries.filter((i) => i.week === week);
	const missingExpected = expectedForWeek.filter((i) => i.required && i.status !== 'found');
	report.push({
		week,
		status: unique.length === 0 ? 'missing' : missingExpected.length ? 'partial' : 'found',
		files: files.map(({ name, source, sha256, bytes, extension, weekMethod, inferredWeeks, metadata, provenanceStatus, mappingMatch }) => ({
			name,
			source,
			sha256,
			bytes,
			format: extension.slice(1),
			weekEvidence: { method: weekMethod, candidates: inferredWeeks },
			provenanceStatus,
			metadata,
			mappingMatch,
		})),
		uniqueTranscriptCount: primarySource.size,
		duplicateSources: files.filter((file) => primarySource.get(file.sha256) !== file.source).map(({ source, sha256 }) => ({ source, sha256 })),
		expectedMeetings: expectedForWeek,
		missingExpectedIds: missingExpected.map((i) => i.id),
	});
	const body = unique.length
		? unique
				.map(
					(file) =>
						`${[
							`Source: ${file.source}`,
							`SHA-256: ${file.sha256}`,
							`Week evidence: ${file.weekMethod}${file.inferredWeeks.length ? ` (${file.inferredWeeks.join(', ')})` : ''}`,
							`Provenance: ${file.provenanceStatus}`,
							...Object.entries(file.metadata).map(([key, i]) => `${key}: ${Array.isArray(i) ? i.join(', ') : i}`),
						].join('\n')}\n\n${file.text}`,
				)
				.join('\n\n---\n\n')
		: `No transcript file was assigned to Week ${String(week).padStart(2, '0')} in this run. See transcripts-manifest.json for unresolved files, expected meetings, and capture gaps.`;
	await writeFile(path.join(outputRoot, `Week-${String(week).padStart(2, '0')}.txt`), body.endsWith('\n') ? body : `${body}\n`);
}
await writeFile(path.join(outputRoot, 'transcripts-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
	JSON.stringify(
		{
			output: outputRoot,
			transcriptFiles: entries.length,
			foundWeeks: report.filter((i) => i.status === 'found').length,
			partialWeeks: report.filter((i) => i.status === 'partial').map((i) => i.week),
			missingWeeks: report.filter((i) => i.status === 'missing').map((i) => i.week),
			missingExpectedMeetings: manifest.missingExpectedMeetings.map((i) => i.id),
			unmatchedSources: unmatchedSources.length,
			readErrors: readErrs.length,
			duplicates: report.flatMap((i) => i.duplicateSources).length,
		},
		null,
		2,
	),
);
