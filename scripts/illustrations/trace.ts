import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { trace } from 'potrace';
import { optimize } from 'svgo';

/**
 * The second half of the illustration pipeline: `raw/<id>.png` → potrace →
 * svgo → `static/illustrations/<id>.svg`. The first half — generating the PNGs
 * — is a model's job and lives in PROMPTS.md.
 *
 * Both stages are load-bearing and neither is tunable in passing. The potrace
 * options below are the ones the shipped set was traced with, and svgo runs on
 * its bare defaults: re-run this file against the same PNG and it reproduces
 * the committed SVG byte for byte. Change a number here and every asset in the
 * catalog is a different drawing than the one beside it.
 *
 * `raw/` is not in the repository (PNGs are megabytes and the model can make
 * them again), so a fresh clone traces nothing until PROMPTS.md has been run.
 * That is the intended state: this script converts whatever is sitting in
 * `raw/`, and never reaches for a source it was not given.
 */

const rawDir = path.join(import.meta.dirname, 'raw');
const outDir = path.join(import.meta.dirname, '..', '..', 'static', 'illustrations');

const traceAsync = promisify(trace);

/**
 * `color: 'currentColor'` is why the same file reads on both themes: potrace
 * fills the traced path with it and `ExerciseIllustration.svelte` inlines the
 * SVG rather than using `<img>`, so the path inherits the ink of whatever
 * container it lands in. No background rect is emitted, so nothing ever paints
 * a white box behind the figure.
 */
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
