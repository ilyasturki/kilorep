import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { trace } from 'potrace'

const root = dirname(fileURLToPath(import.meta.url))
const rawDir = join(root, 'raw')
const outDir = join(root, '..', '..', 'public', 'illustrations')

mkdirSync(outDir, { recursive: true })

const traceAsync = promisify(trace)

// `color: currentColor` makes the traced strokes inherit the surrounding text
// color, so the same asset reads correctly on both the dark and light themes.
// Background stays transparent (no rect) so it never paints a white box.
const options = {
    threshold: 128,
    color: 'currentColor',
    turdSize: 5,
    optTolerance: 0.4,
    turnPolicy: 'minority',
}

const slugs = readdirSync(rawDir)
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.replace(/\.png$/, ''))
    .toSorted()

let bytes = 0
for (const slug of slugs) {
    const svg = await traceAsync(join(rawDir, `${slug}.png`), options)
    const outPath = join(outDir, `${slug}.svg`)
    writeFileSync(outPath, svg)
    bytes += Buffer.byteLength(svg)
}

console.log(
    `Traced ${slugs.length} illustrations to ${outDir} (${(bytes / 1024).toFixed(0)} KB total, ${(bytes / slugs.length / 1024).toFixed(1)} KB avg)`,
)
