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

const args = process.argv.slice(2);
/** Reads one named command-line option from the process arguments.
 * @param {string} name - Option name without its leading dashes.
 * @returns {string|undefined} Option value when the caller supplied it.
 */
const value = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const inputArg = value('input');
const outputArg = value('output');
const weeks = Number(value('weeks') || 12);
const mappingArg = value('mapping');
const expectedArg = value('expected');
const inputRoot = path.resolve(inputArg || '.');
const outputRoot = path.resolve(outputArg || '.');
const allowed = new Set(['.txt', '.vtt', '.srt']);
const transcriptNameSignal = /(transcript|caption|subtitle|lecture|recording|zoom|kaltura|machine[-_ ]transcribed)/i;
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
const expectedMeetings = expectedMeetingsFrom(expectedInput.value);
/** Transcript entries grouped by their resolved week number.
 * @type {Map<number, TranscriptEntry[]>} - Unresolved sources remain in diagnostics only.
 */
const grouped = new Map();
const expectedReport = () => expectedMeetings.map(i => {
	const week = Number(i.week);
	const tokens = [...(Array.isArray(i.matchAny) ? i.matchAny : []), ...(Array.isArray(i.expectedIds) ? i.expectedIds : []), i.id].map(normMatch).filter(Boolean);
	const matched = entries.filter(entry => {
		const expectedIds = isStringArray(entry.metadata.expectedIds) ? entry.metadata.expectedIds : [];
		const haystack = [entry.source, entry.name, entry.metadata.meetingTitle, ...expectedIds].filter(Boolean).map(normMatch);
		return tokens.some(token => haystack.some(value => value.includes(token)));
	});
	const correctlyClassified = matched.filter(entry => entry.week === week);
	const wrongWeek = matched.filter(entry => Number.isInteger(entry.week) && entry.week !== week);
	return {
		id: i.id,
		week,
		title: i.title || i.id,
		required: i.required !== false,
		status: correctlyClassified.length ? 'found' : wrongWeek.length ? 'wrong-week' : matched.length ? 'unassigned-week' : 'missing',
		matchedSources: matched.map(entry => ({ source: entry.source, week: entry.week ?? null, sha256: entry.sha256 })),
	};
});
const report = [];
const manifest = {
	inputDirectoryName: path.basename(inputRoot),
	outputDirectoryName: path.basename(outputRoot),
	expectedWeeks: weeks,
	options: {
		mapping: mappingInput.name ? { file: mappingInput.name, sha256: mappingInput.sha256 } : null,
		expected: expectedInput.name ? { file: expectedInput.name, sha256: expectedInput.sha256 } : null,
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
 * Checks whether mapping metadata contains only supported optional field types.
 *
 * @param {unknown} value - Source mapping value to inspect.
 *
 * @return {value is MappingRecord} Whether the mapping can be safely used.
 */
function isMappingRecord(value) {
	return (
		isRecord(value) &&
		(value.week === undefined || typeof value.week === 'string' || typeof value.week === 'number') &&
		['recordingUrl', 'meetingTitle', 'meetingDate', 'platform', 'captureMethod', 'transcriptOrigin', 'language', 'visibleVerification', 'captionStatus'].every(
			key => value[key] === undefined || typeof value[key] === 'string',
		) &&
		(value.expectedIds === undefined || (Array.isArray(value.expectedIds) && value.expectedIds.every(id => typeof id === 'string')))
	);
}

/**
 * Checks whether an expected source has a usable ID, week, and matching metadata.
 *
 * @param {unknown} value - Expected-meeting record to inspect.
 *
 * @return {value is ExpectedMeeting} Whether the source record is supported.
 */
function isExpectedMeeting(value) {
	return (
		isRecord(value) &&
		typeof value.id === 'string' &&
		(typeof value.week === 'number' || typeof value.week === 'string') &&
		Number.isInteger(Number(value.week)) &&
		Number(value.week) >= 1 &&
		(value.title === undefined || typeof value.title === 'string') &&
		(value.required === undefined || typeof value.required === 'boolean') &&
		['matchAny', 'expectedIds'].every(key => value[key] === undefined || (Array.isArray(value[key]) && value[key].every(i => typeof i === 'string')))
	);
}

/**
 * Narrows a JSON value to expected-meeting records after validating every entry.
 *
 * @param {unknown} value - Expected-meetings value to inspect.
 *
 * @return {value is ExpectedMeeting[]} Whether the value is a valid meeting list.
 */
function isExpectedMeetingList(value) {
	return Array.isArray(value) && value.every(isExpectedMeeting);
}

/** Validates the optional expected-meetings file and returns its records.
 * @param {unknown} value - Parsed optional configuration.
 * @returns {ExpectedMeeting[]} Valid expected-meeting entries, or an empty list.
 */
function expectedMeetingsFrom(value) {
	const config = isRecord(value) ? value : {};
	const meetings = config.meetings || [];
	if (!isExpectedMeetingList(meetings)) throw new Error('Expected-meetings JSON must contain valid meeting records.');
	return meetings;
}

/**
 * Checks whether a value is a list of strings.
 *
 * @param {unknown} value - Value to inspect.
 *
 * @return {value is string[]} Whether every entry is a string.
 */
function isStringArray(value) {
	return Array.isArray(value) && value.every(i => typeof i === 'string');
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
 * Converts an input path to a path relative to the transcript source directory.
 *
 * @param {string} file - Absolute file path discovered by the walker.
 *
 * @return {string} Slash-separated relative path.
 */
function relativeName(file) {
	return path.relative(inputRoot, file).split(path.sep).join('/');
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
 * Removes credentials, query parameters, and fragments from a recording URL.
 *
 * @param {unknown} value - Candidate recording URL from the mapping file.
 *
 * @return {string|undefined} Sanitized URL, or `undefined` for invalid input.
 */
function cUrl(value) {
	if (typeof value !== 'string' || !value) return undefined;
	try {
		const url = new URL(value);
		url.username = '';
		url.password = '';
		url.search = '';
		url.hash = '';
		return url.toString();
	} catch {
		return undefined;
	}
}

/**
 * Copies approved provenance fields while excluding arbitrary mapping data.
 *
 * @param {MappingRecord} record - Mapping metadata for one transcript source.
 *
 * @return {Record<string, unknown>} Safe metadata suitable for the report.
 */
function sMetadata(record = {}) {
	/** Approved metadata copied to a report entry.
	 * @type {Record<string, unknown>} - Contains only values from the explicit metadata allowlist.
	 */
	const metadata = {};
	for (const key of ['week', 'meetingTitle', 'meetingDate', 'platform', 'captureMethod', 'transcriptOrigin', 'language', 'visibleVerification', 'captionStatus', 'expectedIds']) {
		const item = record[key];
		if (item !== undefined && item !== null && item !== '') metadata[key] = item;
	}
	const recordingUrl = cUrl(record.recordingUrl);
	if (recordingUrl) metadata.recordingUrl = recordingUrl;
	return metadata;
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
		throw new Error(`Could not read ${label} JSON ${path.basename(fullPath)}: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Resolves one transcript path against exact-path and unique-basename mappings.
 *
 * @param {string} source - Slash-separated path relative to the transcript input root.
 *
 * @return {{record: MappingRecord|undefined, key: string|undefined, match: string}} Mapping and match provenance.
 */
function mappingFor(source) {
	const norm = normLookup(source);
	if (mappingByPath.has(norm)) return { record: mappingByPath.get(norm), key: norm, match: 'relative-path' };
	const byName = mappingByBaseName.get(path.posix.basename(norm)) || [];
	if (byName.length === 1) return { record: byName[0], key: path.posix.basename(norm), match: 'unique-basename' };
	if (byName.length > 1) return { record: undefined, key: path.posix.basename(norm), match: 'ambiguous-basename' };
	return { record: undefined, key: undefined, match: 'none' };
}

/**
 * Finds week numbers expressed in a transcript's source path.
 *
 * @param {string} source - Relative file path inspected for week naming patterns.
 *
 * @return {number[]} Sorted distinct candidate week numbers.
 */
function weekCandidates(source) {
	/** Candidate week values discovered in the source name.
	 * @type {Set<number>} Unique positive week numbers collected from the patterns.
	 */
	const candidates = new Set();
	const patterns = [
		/\bweek[\s._/-]*0*(\d{1,2})(?!\d)/gi,
		/(?:^|[^a-z0-9])(?:wk|w)[\s._-]*0*(\d{1,2})(?!\d)/gi,
		/\b(?:lecture|session)[\s._-]*0*(\d{1,2})(?!\d)/gi,
		/(?:^|[/\\])0*(\d{1,2})[\s._-]*(?:lecture|session|recording|transcript|caption)\b/gi,
	];
	for (const pattern of patterns) {
		for (const match of source.matchAll(pattern)) candidates.add(Number(match[1]));
	}
	return [...candidates].sort((a, b) => a - b);
}

/**
 * Decides whether a local file is relevant to transcript inventory.
 *
 * @param {string} source - Relative path used for filename matching.
 * @param {string} ext - Lowercase filename extension.
 * @param {boolean} hasMapping - Whether the source has explicit mapping metadata.
 *
 * @return {boolean} Whether the file should be read and inventoried.
 */
function isTranscriptCandidate(source, ext, hasMapping) {
	if (hasMapping) return true;
	if (ext === '.vtt' || ext === '.srt') return true;
	return transcriptNameSignal.test(source);
}

/**
 * Recursively inventories supported transcript files while excluding the output tree.
 *
 * @param {string} dir - Directory currently being visited.
 *
 * @return {Promise<void>} Resolves after every child directory and file is processed.
 */
async function walk(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (path.relative(outputRoot, full) === '' || (!path.relative(outputRoot, full).startsWith(`..${path.sep}`) && !path.isAbsolute(path.relative(outputRoot, full)))) continue;
		if (entry.isDirectory()) {
			await walk(full);
			continue;
		}
		const ext = path.extname(entry.name).toLowerCase();
		if (!allowed.has(ext)) continue;
		const source = relativeName(full);
		const mapping = mappingFor(source);
		if (mapping.match === 'ambiguous-basename') unmatchedSources.push({ source, reason: 'ambiguous-mapping-basename', mappingKey: mapping.key });
		if (!isTranscriptCandidate(source, ext, Boolean(mapping.record))) continue;
		const inferredWeeks = weekCandidates(source);
		const mappedWeek = Number(mapping.record?.week);
		const week = Number.isInteger(mappedWeek) && mappedWeek > 0 ? mappedWeek : inferredWeeks.length === 1 ? inferredWeeks[0] : undefined;
		const weekMethod = Number.isInteger(mappedWeek) && mappedWeek > 0 ? 'manual-mapping' : inferredWeeks.length === 1 ? 'path-pattern' : 'unresolved';
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
		const metadata = sMetadata(mapping.record);
		const provenanceRecorded = Boolean(metadata.platform && (metadata.captureMethod || metadata.transcriptOrigin));
		entries.push({
			week,
			weekMethod,
			inferredWeeks,
			name: entry.name,
			source,
			extension: ext,
			sha256: hash(bytes),
			bytes: bytes.byteLength,
			text: bytes.toString('utf8'),
			metadata,
			provenanceStatus: provenanceRecorded ? 'recorded' : 'incomplete-or-unknown',
			mappingMatch: mapping.match,
		});
		if (!week) unmatchedSources.push({ source, reason: inferredWeeks.length > 1 ? 'ambiguous-week-patterns' : 'week-not-determined', inferredWeeks, mappingMatch: mapping.match });
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
	if (!isMappingRecord(rawRecord)) continue;
	const record = rawRecord;
	const normKey = normLookup(key);
	mappingByPath.set(normKey, record);
	const baseName = path.posix.basename(normKey);
	mappingByBaseName.set(baseName, [...(mappingByBaseName.get(baseName) || []), record]);
}
await walk(inputRoot);
const expectedReportEntries = expectedReport();
manifest.transcriptFileCount = entries.length;
manifest.missingExpectedMeetings = expectedReportEntries.filter(i => i.required && i.status !== 'found');
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
	const primarySource = new Map(unique.map(file => [file.sha256, file.source]));
	const duplicates = files.filter(file => primarySource.get(file.sha256) !== file.source);
	const expectedForWeek = expectedReportEntries.filter(i => i.week === week);
	const missingExpected = expectedForWeek.filter(i => i.required && i.status !== 'found');
	const status = unique.length === 0 ? 'missing' : missingExpected.length ? 'partial' : 'found';
	const record = {
		week,
		status,
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
		uniqueTranscriptCount: unique.length,
		duplicateSources: duplicates.map(({ source, sha256 }) => ({ source, sha256 })),
		expectedMeetings: expectedForWeek,
		missingExpectedIds: missingExpected.map(i => i.id),
	};
	report.push(record);
	const body = unique.length
		? unique
				.map(file => {
					const evidence = [
						`Source: ${file.source}`,
						`SHA-256: ${file.sha256}`,
						`Week evidence: ${file.weekMethod}${file.inferredWeeks.length ? ` (${file.inferredWeeks.join(', ')})` : ''}`,
						`Provenance: ${file.provenanceStatus}`,
						...Object.entries(file.metadata).map(([key, i]) => `${key}: ${Array.isArray(i) ? i.join(', ') : i}`),
					].join('\n');
					return `${evidence}\n\n${file.text}`;
				})
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
			foundWeeks: report.filter(i => i.status === 'found').length,
			partialWeeks: report.filter(i => i.status === 'partial').map(i => i.week),
			missingWeeks: report.filter(i => i.status === 'missing').map(i => i.week),
			missingExpectedMeetings: manifest.missingExpectedMeetings.map(i => i.id),
			unmatchedSources: unmatchedSources.length,
			readErrors: readErrs.length,
			duplicates: report.flatMap(i => i.duplicateSources).length,
		},
		null,
		2,
	),
);
