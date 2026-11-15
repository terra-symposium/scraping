import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkCollection, safeSourceUrl } from '../dist/collection.js';

test('source provenance strips secrets and rejects non-web URLs', () => {
	assert.equal(safeSourceUrl('https://user:password@example.edu/page?token=secret#part'), 'https://example.edu/page');
	assert.throws(() => safeSourceUrl('file:///private/session.json'), /HTTP or HTTPS/);
});

test('partial captures keep a reason per inaccessible item and detect duplicate IDs', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'scraping-collection-'));
	try {
		const file = path.join(root, 'page.txt');
		await writeFile(file, 'Visible page');
		const captured = { sourceId: 'page-1', title: 'Page', section: 'Week 1', safeUrl: 'https://example.edu/page', type: 'page', status: 'captured', localPath: file, reason: null };
		const restricted = {
			sourceId: 'page-2',
			title: 'Locked page',
			section: 'Week 1',
			safeUrl: 'https://example.edu/locked',
			type: 'restricted',
			status: 'restricted',
			localPath: null,
			reason: 'Locked in Canvas',
		};
		assert.deepEqual(await checkCollection([captured, restricted]), []);
		assert.match((await checkCollection([captured, captured]))[0], /Repeated source ID/);
		assert.match((await checkCollection([{ ...restricted, reason: null }]))[0], /Missing reason/);
		assert.match((await checkCollection([{ ...captured, safeUrl: 'https://example.edu/page?token=secret' }]))[0], /Unsafe source URL/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
