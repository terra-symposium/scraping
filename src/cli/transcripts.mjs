#!/usr/bin/env node
/*
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

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
	console.log('Usage: canvas-transcripts --input=EXPORT_DIR --output=TRANSCRIPT_DIR [--weeks=12] [--mapping=SOURCE_MAP.json] [--expected=EXPECTED_MEETINGS.json]');
	process.exit(0);
}
/**
 * Reads the value of a command-line option without consuming the process arguments.
 *
 * @param {string} name - Option name without its leading dashes.
 * @return {string|undefined} The first matching option value, if supplied.
 */
function getOptionValue(name) {
	const prefix = `--${name}=`;
	for (const arg of args) {
		if (arg.startsWith(prefix)) return arg.slice(prefix.length);
	}
	return undefined;
}

const inputArg = getOptionValue('input');
const outputArg = getOptionValue('output');
const weeks = Number(getOptionValue('weeks') || 12);
const inputRoot = path.resolve(inputArg || '.');
const outputRoot = path.resolve(outputArg || '.');
const mappingArg = getOptionValue('mapping');
const expectedArg = getOptionValue('expected');
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
if (!Array.isArray(expectedMeetings) || !expectedMeetings.every(isExpectedMeeting)) throw new Error('Expected-meetings JSON must contain valid meeting records.');
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
 * Checks whether an expected-meeting record has the fields used by matching and reporting.
 *
 * @param {unknown} v - Candidate record parsed from the expected-meetings JSON.
 * @return {value is ExpectedMeeting} Whether the record satisfies the inventory contract.
 */
function isExpectedMeeting(v) {
	if (
		!isRecord(v) ||
		typeof v.id !== 'string' ||
		(typeof v.week !== 'number' && typeof v.week !== 'string') ||
		!Number.isInteger(Number(v.week)) ||
		Number(v.week) < 1 ||
		(v.title !== undefined && typeof v.title !== 'string') ||
		(v.required !== undefined && typeof v.required !== 'boolean')
	)
		return false;
	for (const key of ['matchAny', 'expectedIds']) {
		if (v[key] !== undefined && !isStringArray(v[key])) return false;
	}
	return true;
}

/**
 * Checks whether every member of a JSON value is a string.
 *
 * @param {unknown} value - Candidate array from parsed metadata.
 * @return {value is string[]} Whether the value is a string array.
 */
function isStringArray(value) {
	if (!Array.isArray(value)) return false;
	for (const item of value) {
		if (typeof item !== 'string') return false;
	}
	return true;
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

/**
 * Compares numeric week candidates in ascending order.
 *
 * @param {number} l - First candidate week.
 * @param {number} r - Second candidate week.
 * @return {number} Negative, zero, or positive according to numeric order.
 */
function compNumbers(l, r) {
	return l - r;
}

/**
 * Compares transcript entries by their source-relative paths.
 *
 * @param {TranscriptEntry} l - First transcript entry.
 * @param {TranscriptEntry} r - Second transcript entry.
 * @return {number} Locale comparison result for the source paths.
 */
function compSourceEntries(l, r) {
	return l.source.localeCompare(r.source);
}

/**
 * Builds expected-meeting status by matching configured identifiers against collected transcripts.
 *
 * @param {unknown} rawMeeting - Validated expected-meeting object from configuration.
 * @return {object} Status and matched source details for the requested meeting.
 */
function createExpectedMeetingReport(rawMeeting) {
	const meeting = /** @type {ExpectedMeeting} */ (rawMeeting);
	const week = Number(meeting.week);
	const matched = [];
	for (const entry of entries) {
		if (entryMatchesMeeting(entry, meeting)) matched.push(entry);
	}
	let foundInExpectedWeek = false;
	let foundInAnotherWeek = false;
	for (const entry of matched) {
		if (entry.week === week) foundInExpectedWeek = true;
		if (Number.isInteger(entry.week) && entry.week !== week) foundInAnotherWeek = true;
	}
	let status = 'missing';
	if (foundInExpectedWeek) status = 'found';
	else if (foundInAnotherWeek) status = 'wrong-week';
	else if (matched.length) status = 'unassigned-week';
	const matchedSources = [];
	for (const entry of matched) matchedSources.push(toMatchedSource(entry));
	return { id: meeting.id, week, title: meeting.title || meeting.id, required: meeting.required !== false, status, matchedSources };
}

/**
 * Checks the transcript names and metadata that an expected-meeting record declares as matches.
 *
 * @param {TranscriptEntry} entry - Collected transcript candidate.
 * @param {ExpectedMeeting} meeting - Expected meeting to match.
 * @return {boolean} Whether any configured token occurs in any transcript identifier.
 */
function entryMatchesMeeting(entry, meeting) {
	const configuredIds = [];
	if (Array.isArray(meeting.matchAny)) configuredIds.push(...meeting.matchAny);
	if (Array.isArray(meeting.expectedIds)) configuredIds.push(...meeting.expectedIds);
	configuredIds.push(meeting.id);
	const tokens = [];
	for (const configuredId of configuredIds) {
		const token = normMatch(configuredId);
		if (token) tokens.push(token);
	}
	const candidateValues = [entry.source, entry.name, entry.metadata.meetingTitle];
	if (isStringArray(entry.metadata.expectedIds)) candidateValues.push(...entry.metadata.expectedIds);
	for (const candidateValue of candidateValues) {
		if (!candidateValue) continue;
		const candidateMatchText = normMatch(candidateValue);
		for (const token of tokens) {
			if (candidateMatchText.includes(token)) return true;
		}
	}
	return false;
}

/**
 * Converts a transcript entry into the source reference stored in expected-meeting reports.
 *
 * @param {TranscriptEntry} entry - Matched transcript candidate.
 * @return {{source: string, week: number|null, sha256: string}} Compact source provenance.
 */
function toMatchedSource(entry) {
	return { source: entry.source, week: entry.week ?? null, sha256: entry.sha256 };
}

/**
 * Selects report fields and names the transcript extension as its output format.
 *
 * @param {TranscriptEntry} entry - Collected transcript details.
 * @return {object} Public fields written into one week report.
 */
function toReportFile(entry) {
	return {
		name: entry.name,
		source: entry.source,
		sha256: entry.sha256,
		bytes: entry.bytes,
		format: entry.extension.slice(1),
		weekEvidence: { method: entry.weekMethod, candidates: entry.inferredWeeks },
		provenanceStatus: entry.provenanceStatus,
		metadata: entry.metadata,
		mappingMatch: entry.mappingMatch,
	};
}

/**
 * Renders the unique transcript records assigned to one week, including their provenance headers.
 *
 * @param {TranscriptEntry[]} unique - Deduplicated transcript records for the week.
 * @param {number} week - Week number being written.
 * @return {string} Plain-text contents for the week file.
 */
function renderWeekBody(unique, week) {
	if (!unique.length)
		return `No transcript file was assigned to Week ${String(week).padStart(2, '0')} in this run. See transcripts-manifest.json for unresolved files, expected meetings, and capture gaps.`;
	const rendered = [];
	for (const entry of unique) rendered.push(renderTranscript(entry));
	return rendered.join('\n\n---\n\n');
}

/**
 * Formats a transcript and its approved provenance as one plain-text section.
 *
 * @param {TranscriptEntry} entry - Transcript contents and metadata.
 * @return {string} Transcript section with source, digest, week evidence, and provenance.
 */
function renderTranscript(entry) {
	const metadataLines = [];
	for (const [key, value] of Object.entries(entry.metadata)) metadataLines.push(fmtMetadataField(key, value));
	const header = [
		`Source: ${entry.source}`,
		`SHA-256: ${entry.sha256}`,
		`Week evidence: ${entry.weekMethod}${entry.inferredWeeks.length ? ` (${entry.inferredWeeks.join(', ')})` : ''}`,
		`Provenance: ${entry.provenanceStatus}`,
		...metadataLines,
	].join('\n');
	return `${header}\n\n${entry.text}`;
}

/**
 * Converts one approved metadata value to the display form used in transcript headers.
 *
 * @param {string} key - Metadata field name.
 * @param {unknown} value - Approved field value.
 * @return {string} Human-readable key-value line.
 */
function fmtMetadataField(key, value) {
	return `${key}: ${Array.isArray(value) ? value.join(', ') : value}`;
}

/**
 * Summarizes the files and week states emitted by the inventory run.
 *
 * @return {object} Counts and identifiers printed to stdout after writing reports.
 */
function createSummary() {
	let foundWeeks = 0;
	const partialWeeks = [];
	const missingWeeks = [];
	let duplicates = 0;
	for (const weekReport of report) {
		if (weekReport.status === 'found') foundWeeks++;
		if (weekReport.status === 'partial') partialWeeks.push(weekReport.week);
		if (weekReport.status === 'missing') missingWeeks.push(weekReport.week);
		duplicates += weekReport.duplicateSources.length;
	}
	const missingExpectedMeetings = [];
	for (const meeting of manifest.missingExpectedMeetings) missingExpectedMeetings.push(meeting.id);
	return {
		output: outputRoot,
		transcriptFiles: entries.length,
		foundWeeks,
		partialWeeks,
		missingWeeks,
		missingExpectedMeetings,
		unmatchedSources: unmatchedSources.length,
		readErrors: readErrs.length,
		duplicates,
	};
}

if (!inputArg || !outputArg || !Number.isInteger(weeks) || weeks < 1) {
	console.error('Usage: canvas-transcripts --input=EXPORT_DIR --output=TRANSCRIPT_DIR [--weeks=12] [--mapping=SOURCE_MAP.json] [--expected=EXPECTED_MEETINGS.json]');
	process.exit(2);
}
if (inputRoot === outputRoot) throw new Error('Input and output directories must differ.');
await mkdir(outputRoot, { recursive: true });
if (!isRecord(mappingObjectValue)) throw new Error('Source mapping must be an object keyed by source-relative path or filename.');
for (const [key, rawRecord] of Object.entries(mappingObjectValue)) {
	let hasValidStringMetadata = true;
	for (const field of ['recordingUrl', 'meetingTitle', 'meetingDate', 'platform', 'captureMethod', 'transcriptOrigin', 'language', 'visibleVerification', 'captionStatus']) {
		if (rawRecord && isRecord(rawRecord) && rawRecord[field] !== undefined && typeof rawRecord[field] !== 'string') {
			hasValidStringMetadata = false;
			break;
		}
	}
	if (
		!isRecord(rawRecord) ||
		(rawRecord.week !== undefined && typeof rawRecord.week !== 'string' && typeof rawRecord.week !== 'number') ||
		!hasValidStringMetadata ||
		(rawRecord.expectedIds !== undefined && !isStringArray(rawRecord.expectedIds))
	)
		continue;
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
	const inferredWeeks = [...candidates].sort(compNumbers);
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
const expectedReportEntries = [];
for (const rawMeeting of expectedMeetings) expectedReportEntries.push(createExpectedMeetingReport(rawMeeting));
manifest.transcriptFileCount = entries.length;
for (const expected of expectedReportEntries) {
	if (expected.required && expected.status !== 'found') manifest.missingExpectedMeetings.push(expected);
}
entries.sort(compSourceEntries);
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
	const primarySource = new Map();
	for (const file of unique) primarySource.set(file.sha256, file.source);
	const expectedForWeek = [];
	const missingExpected = [];
	for (const expected of expectedReportEntries) {
		if (expected.week !== week) continue;
		expectedForWeek.push(expected);
		if (expected.required && expected.status !== 'found') missingExpected.push(expected);
	}
	const reportFiles = [];
	for (const file of files) reportFiles.push(toReportFile(file));
	const duplicateSources = [];
	for (const file of files) {
		if (primarySource.get(file.sha256) !== file.source) duplicateSources.push({ source: file.source, sha256: file.sha256 });
	}
	const missingExpectedIds = [];
	for (const expected of missingExpected) missingExpectedIds.push(expected.id);
	report.push({
		week,
		status: unique.length === 0 ? 'missing' : missingExpected.length ? 'partial' : 'found',
		files: reportFiles,
		uniqueTranscriptCount: primarySource.size,
		duplicateSources,
		expectedMeetings: expectedForWeek,
		missingExpectedIds,
	});
	const body = renderWeekBody(unique, week);
	await writeFile(path.join(outputRoot, `Week-${String(week).padStart(2, '0')}.txt`), body.endsWith('\n') ? body : `${body}\n`);
}
await writeFile(path.join(outputRoot, 'transcripts-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(createSummary(), null, 2));
