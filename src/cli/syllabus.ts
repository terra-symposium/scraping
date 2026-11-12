/**
 * src/cli/syllabus.ts
 */

/*//////////////////////////////////////////////////
IMPORTS
//////////////////////////////////////////////////*/

// API
import { fetchAustralianSyllabus } from '../workflows/syllabus.js';

// DATA
import { AUSTRALIAN_SYLLABUS_SOURCES } from '../workflows/syllabus.js';

// TYPES
import type { AustralianSyllabusState } from '../workflows/syllabus.js';

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

/**
 * Announces that an interactive sign-in window is ready for the user.
 */
function notifyInteractiveSignIn(): void {
	console.log('Complete sign-in in the visible browser window.');
}

/*//////////////////////////////////////////////////
HELPERS
//////////////////////////////////////////////////*/

try {
	if (args.includes('--help') || args.includes('-h'))
		console.log(`Usage: syllabus-fetch --state=NSW [options]
States: ${Object.keys(AUSTRALIAN_SYLLABUS_SOURCES).join(', ')}
Options:
  --output=DIR                Download directory
  --file-name=NAME            Optional saved filename
  --syllabus-name=NAME        Optional NSW custom syllabus selection
  --headed                    Keep a visible browser for the workflow
  --interactive               Permit visible manual sign-in if needed
  --storage-state=PATH        Playwright state file; defaults outside the repository
  --timeout=MS                Download-control timeout (default: 30000)
  --help                      Show this help`);
	else {
		const state = option('state')?.toUpperCase() as AustralianSyllabusState | undefined;
		if (!state || !(state in AUSTRALIAN_SYLLABUS_SOURCES)) throw new Error('A supported jurisdiction is required. Run syllabus-fetch --help for usage.');
		const timeoutMs = Number(option('timeout'));
		console.log(
			JSON.stringify(
				await fetchAustralianSyllabus({
					state,
					outputDirectory: option('output'),
					fileName: option('file-name'),
					syllabusName: option('syllabus-name'),
					headed: args.includes('--headed'),
					interactive: args.includes('--interactive') || args.includes('--headed'),
					storageStatePath: option('storage-state'),
					...(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
					onInteractiveStart: notifyInteractiveSignIn,
				}),
				null,
				2,
			),
		);
	}
} catch (err: unknown) {
	console.error(err instanceof Error ? err.message : String(err));
	process.exitCode = 1;
}
