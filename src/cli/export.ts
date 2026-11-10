#!/usr/bin/env node
import { scrapeCanvas } from '../canvas.js';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
	const prefix = `--${name}=`;
	const inline = args.find((argument) => argument.startsWith(prefix));
	if (inline) return inline.slice(prefix.length);
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
};

function printUsage(): void {
	console.log(`Usage: canvas-export --canvas-url=URL [options]

Options:
  --groups="Week 1,Week 2"  Export matching module groups by title
  --output=PATH              Export directory (default: ~/Downloads/canvas-export)
  --headed                   Open a visible browser for sign-in when needed
  --storage-state=PATH        Browser state file (default: OS application-support directory)
  --all-courses               Include visible courses without a semester in the title
  --help                     Show this help`);
}

async function main(): Promise<void> {
	if (args.includes('--help') || args.includes('-h')) return printUsage();
	const canvasUrl = option('canvas-url');
	if (!canvasUrl) throw new Error('Canvas URL is required. Run canvas-export --help for usage.');
	const result = await scrapeCanvas({
		canvasUrl,
		output: option('output'),
		storageStatePath: option('storage-state'),
		groupMatches: (option('groups') || option('group') || '').split(',').map((value) => value.trim()).filter(Boolean),
		headed: args.includes('--headed') || args.includes('--interactive'),
		includeAllCourses: args.includes('--all-courses'),
	});
	console.log(JSON.stringify({ output: result.output, manifest: result.manifest }, null, 2));
}

void main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
