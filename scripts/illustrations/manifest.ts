import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const svgDir = path.join(import.meta.dirname, '..', '..', 'static', 'illustrations');
const out = path.join(
	import.meta.dirname,
	'..',
	'..',
	'src',
	'lib',
	'exercises',
	'illustrations.json'
);

const names = readdirSync(svgDir)
	.filter((file) => file.endsWith('.svg'))
	.map((file) => file.replace(/\.svg$/u, ''))
	.toSorted();

writeFileSync(out, `${JSON.stringify(names, null, '\t')}\n`);

console.log(`Listed ${names.length} illustrations in ${out}`);
