/**
 * src/collection.ts
 */
/*//////////////////////////////////////////////////
IMPORTS
//////////////////////////////////////////////////*/

import { access } from 'node:fs/promises';

/**
 * One discovered source item, including unsuccessful and excluded items.
 */
export type CollectedItem = {
	sourceId: string;
	title: string;
	section: string;
	safeUrl: string;
	type: 'page' | 'file' | 'link' | 'syllabus' | 'restricted';
	status: 'captured' | 'linked' | 'duplicate' | 'inaccessible' | 'restricted' | 'excluded';
	localPath: string | null;
	reason: string | null;
	parentSourceId?: string;
};

/**
 * Strip URL secrets and reject non-web schemes before provenance is stored.
 * @param value - Source URL to sanitize.
 * @return URL without credentials, query parameters, or fragment.
 */
export function safeSourceUrl(value: string): string {
	const url = new URL(value);
	if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Source URL must use HTTP or HTTPS.');
	url.username = '';
	url.password = '';
	url.search = '';
	url.hash = '';
	return url.href;
}

/**
 * Validate a partial or complete capture before a consumer imports it.
 * @param items - Captured inventory to verify.
 * @return Validation errors; an empty array means the inventory is valid.
 */
export async function checkCollection(items: CollectedItem[]): Promise<string[]> {
	const errs: string[] = [];
	const ids = new Set<string>();
	for (const item of items) {
		if (!item.sourceId || !item.title || !item.section) errs.push('Missing item identity or label.');
		if (ids.has(item.sourceId) && item.status !== 'duplicate') errs.push(`Repeated source ID: ${item.sourceId}`);
		ids.add(item.sourceId);
		try {
			if (safeSourceUrl(item.safeUrl) !== item.safeUrl) errs.push(`Unsafe source URL: ${item.sourceId}`);
		} catch {
			errs.push(`Invalid source URL: ${item.sourceId}`);
		}
		if (item.status === 'captured') {
			if (!item.localPath) errs.push(`Captured item has no file: ${item.sourceId}`);
			else await access(item.localPath).catch(() => errs.push(`Missing captured file: ${item.sourceId}`));
		}
		if (['inaccessible', 'restricted', 'excluded'].includes(item.status) && !item.reason) errs.push(`Missing reason: ${item.sourceId}`);
	}
	return errs;
}
