#!/usr/bin/env node

/*//////////////////////////////////////////////////
IMPORTS
//////////////////////////////////////////////////*/

// API
import { scrapeCanvas } from '../canvas.js';

/*//////////////////////////////////////////////////
CONFIG
//////////////////////////////////////////////////*/

const args = process.argv.slice(2);

/**
 * Reads either supported form of a named command-line option.
 *
 * @param name Option name without its leading dashes.
 *
 * @return The option value when supplied, otherwise `undefined`.
 */
function option(name: string): string | undefined {
	const prefix = `--${name}=`;
	for (const argument of args) if (argument.startsWith(prefix)) return argument.slice(prefix.length);
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
}

/*//////////////////////////////////////////////////
HELPERS
//////////////////////////////////////////////////*/

try {
	if (args.includes('--help') || args.includes('-h'))
		console.log(`Usage: canvas-export --canvas-url=URL [options]
Options:
  --groups="Week 1,Week 2"  Export matching module groups by title
  --output=PATH              Export directory (default: ~/Downloads/canvas-export)
  --headed                   Open a visible browser for sign-in when needed
  --storage-state=PATH        Browser state file (default: OS application-support directory)
  --all-courses               Include visible courses without a semester in the title
  --help                     Show this help`);
	else {
		const canvasUrl = option('canvas-url');
		if (!canvasUrl) throw new Error('Canvas URL is required. Run canvas-export --help for usage.');
		const { output, manifest } = await scrapeCanvas({
			canvasUrl,
			output: option('output'),
			storageStatePath: option('storage-state'),
			groupMatches: (option('groups') || option('group') || '')
				.split(',')
				.map(item => item.trim())
				.filter(Boolean),
			headed: args.includes('--headed') || args.includes('--interactive'),
			includeAllCourses: args.includes('--all-courses'),
		});
		console.log(JSON.stringify({ output, manifest }, null, 2));
	}
} catch (err: unknown) {
	console.error(err instanceof Error ? err.message : String(err));
	process.exitCode = 1;
}
