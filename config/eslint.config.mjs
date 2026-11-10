import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['src/**/*.{ts,mts,mjs}'],
		languageOptions: { globals: globals.node },
		rules: { 'no-undef': 'off' },
	},
);
