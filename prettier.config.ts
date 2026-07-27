import type { Config } from 'prettier';

const config: Config = {
	useTabs: true,
	singleQuote: true,
	trailingComma: 'none',
	printWidth: 100,
	// prettier-plugin-tailwindcss must come last — it wraps whichever parsers the
	// preceding plugins register.
	plugins: ['prettier-plugin-svelte', 'prettier-plugin-tailwindcss'],
	tailwindStylesheet: './src/app.css',
	overrides: [{ files: '*.svelte', options: { parser: 'svelte' } }]
};

export default config;
