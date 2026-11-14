#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { formatQualityConfig, runQualityFromCfg as installedRunQualityFromCfg } from '../config/quality-entry.mjs';

const script = fileURLToPath(import.meta.url);
const root = dirname(dirname(script));
const cwd = resolve(process.cwd());
const packagePath = relative(root, cwd);
if (packagePath.startsWith('..' + sep) || packagePath === '..') {
	throw new Error(`Quality must run inside ${root}`);
}
const repositoryPackage = packagePath === '' || packagePath === 'config';
const baseConfig = [join(root, 'quality.json'), join(root, 'config/quality.json')].find(existsSync);
if (!baseConfig) throw new Error(`Missing quality.json in ${root}`);
const args = process.argv.slice(2).filter(arg => arg !== '--');

if (process.env.QUALITY_RUNNER_SCOPE_ONLY === '1') {
	console.log(JSON.stringify({ root, package: packagePath || '.', scope: repositoryPackage ? 'repository' : 'package', config: baseConfig, args }));
	process.exit(0);
}

const raw = JSON.parse(readFileSync(baseConfig, 'utf8'));
raw.root = root;
raw.configRoot = existsSync(join(root, 'config')) ? join(root, 'config') : root;
const generatedLinks = [];
const scan = [root];
const pruned = new Set(['.git', 'node_modules', 'dist', 'target', '.venv', 'vendor']);
while (scan.length) {
	const dir = scan.pop();
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isSymbolicLink()) {
			if (raw.extensions?.some(ext => entry.name.endsWith(ext)) && statSync(path, { throwIfNoEntry: false })?.isDirectory()) generatedLinks.push(relative(root, path));
		} else if (entry.isDirectory() && !pruned.has(entry.name)) scan.push(path);
	}
}
raw.skippedFiles = [...new Set([...(raw.skippedFiles ?? []), 'scripts/quality-runner.mjs', ...generatedLinks])];
const isBuildOrTest = entry => {
	const name = String(entry.name ?? '').toLowerCase();
	const argv = (entry.args ?? []).map(String);
	return /(^|[^a-z])(build|test)([^a-z]|$)/.test(name) || argv.some(arg => /^(?:test(?::.*)?|build(?::.*)?|docs:build)$/.test(arg));
};
raw.qualityCommands = (raw.qualityCommands ?? []).filter(entry => !isBuildOrTest(entry));
if (!repositoryPackage) {
	raw.sourceRoots = [packagePath];
	raw.includeRoots = [];
	raw.lintRoots = [packagePath];
	raw.typecheckRoots = [];
	delete raw.typecheckCommand;
	raw.qualityCommands = [];
	raw.recommendationCommands = [];
	raw.enabledChecks = {
		...raw.enabledChecks,
		type: false,
		knip: false,
		diff: false,
		github: false,
		command: false,
		'documented-commands': false,
	};
}
const cacheRoot = join(root, 'dist/cache/quality-runner');
mkdirSync(cacheRoot, { recursive: true });
const tempDir = mkdtempSync(join(cacheRoot, 'run-'));
const configPath = join(tempDir, 'quality.json');
writeFileSync(configPath, await formatQualityConfig(JSON.stringify(raw), { parser: 'json' }));
try {
	if (args[0] === 'quality' && !args.includes('--warn') && !args.includes('--fix') && !args.includes('--safe-fix')) args.push('--fix');
	const runQualityFromCfg = process.env.STANDARDS_QUALITY_RUNNER
		? (await import(pathToFileURL(process.env.STANDARDS_QUALITY_RUNNER).href)).runQualityFromCfg
		: installedRunQualityFromCfg;
	await runQualityFromCfg(configPath, args);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
