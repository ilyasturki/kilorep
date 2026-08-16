import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { trace } from 'potrace';
import { optimize } from 'svgo';

const rawDir = path.join(import.meta.dirname, 'raw');
const outDir = path.join(import.meta.dirname, '..', '..', 'static', 'illustrations');

const traceAsync = promisify(trace);

// The shipped catalog was traced with these values; changing one re-draws every asset differently.
const options = {
	threshold: 128,
	color: 'currentColor',
	turdSize: 5,
	optTolerance: 0.4,
	turnPolicy: 'minority'
} as const;

const ids = readdirSync(rawDir)
	.filter((file) => file.endsWith('.png'))
	.map((file) => file.replace(/\.png$/u, ''))
	.toSorted();

if (ids.length === 0) {
	console.log(`No PNGs in ${rawDir} — see PROMPTS.md for how to generate them.`);
	process.exit(0);
}

let bytes = 0;

for (const id of ids) {
	const traced = await traceAsync(path.join(rawDir, `${id}.png`), options);
	const { data } = optimize(traced, { multipass: true });

	writeFileSync(path.join(outDir, `${id}.svg`), data);
	bytes += Buffer.byteLength(data);
}

console.log(
	`Traced ${ids.length} illustrations to ${outDir} ` +
		`(${(bytes / 1024).toFixed(0)} KB total, ${(bytes / ids.length / 1024).toFixed(1)} KB avg)`
);
