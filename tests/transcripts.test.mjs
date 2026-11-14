import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { URL, fileURLToPath } from 'node:url';
import test from 'node:test';

/**
 * Runs the inventory command against temporary local fixtures without launching a browser or making network requests.
 *
 * @param {string[]} args - Command-line arguments forwarded to the inventory script.
 * @return {import('node:child_process').SpawnSyncReturns<string>} Captured process output and exit status.
 */
function runTranscriptInventory(args) {
	return spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli/transcripts.mjs', import.meta.url)), ...args], { encoding: 'utf8' });
}

test('transcript inventory reports coverage and removes URL secrets from mapped metadata', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'terra-transcript-inventory-'));
	const input = path.join(root, 'sources');
	const output = path.join(root, 'inventory');
	const mappingPath = path.join(root, 'mapping.json');
	const expectedPath = path.join(root, 'expected.json');
	try {
		const lecturePath = path.join(input, 'Week 01', 'Lecture 01 transcript.txt');
		await mkdir(path.dirname(lecturePath), { recursive: true });
		await mkdir(path.join(input, 'duplicate'), { recursive: true });
		await writeFile(lecturePath, 'lecture transcript');
		await writeFile(path.join(input, 'duplicate', 'Week 01 recording.vtt'), 'lecture transcript');
		await writeFile(path.join(input, 'Week 02 session 02.srt'), 'second week transcript');
		await writeFile(path.join(input, 'Week 03 notes.md'), 'not a transcript');
		await writeFile(
			mappingPath,
			JSON.stringify({
				sources: {
					'week 01/lecture 01 transcript.txt': {
						week: 1,
						recordingUrl: 'https://user:password@example.edu/watch?token=private#session',
						meetingTitle: 'Lecture 01',
						platform: 'Zoom',
						captureMethod: 'caption-export',
						transcriptOrigin: 'captions',
						expectedIds: ['meeting-01'],
						privateNote: 'must not be copied into reports',
					},
				},
			}),
		);
		await writeFile(
			expectedPath,
			JSON.stringify({
				meetings: [
					{ id: 'meeting-01', week: 1, matchAny: ['Lecture 01'] },
					{ id: 'missing-02', week: 2 },
				],
			}),
		);

		const result = runTranscriptInventory([`--input=${input}`, `--output=${output}`, '--weeks=2', `--mapping=${mappingPath}`, `--expected=${expectedPath}`]);

		assert.equal(result.status, 0, result.stderr);
		const manifestText = await readFile(path.join(output, 'transcripts-manifest.json'), 'utf8');
		const manifest = JSON.parse(manifestText);
		const lecture = manifest.weeks[0].files.find(file => file.source === 'Week 01/Lecture 01 transcript.txt');
		assert.equal(manifest.transcriptFileCount, 3);
		assert.equal(lecture.mappingMatch, 'relative-path');
		assert.equal(lecture.metadata.recordingUrl, 'https://example.edu/watch');
		assert.equal(lecture.provenanceStatus, 'recorded');
		assert.equal(manifest.expectedWeeks, 2);
		assert.equal(manifest.weeks[0].status, 'found');
		assert.equal(manifest.weeks[0].duplicateSources.length, 1);
		assert.equal(manifest.weeks[1].status, 'partial');
		assert.equal(manifest.missingExpectedMeetings[0].id, 'missing-02');
		assert.equal(
			manifest.unmatchedSources.some(source => source.source.endsWith('Week 03 notes.md')),
			false,
		);
		assert.doesNotMatch(manifestText, /user:password|token=private|#session|must not be copied/u);
		assert.match(await readFile(path.join(output, 'Week-01.txt'), 'utf8'), /lecture transcript/u);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('transcript inventory rejects using the input directory as output', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'terra-transcript-inventory-same-dir-'));
	try {
		const result = runTranscriptInventory([`--input=${root}`, `--output=${root}`]);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /Input and output directories must differ/u);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
