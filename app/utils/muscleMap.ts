import type { MuscleIntensity, MuscleTarget } from '~~/server/database/schema'

export type MuscleMapShape =
    | {
          el: 'rect'
          x: number
          y: number
          w: number
          h: number
          rx: number
          m: string[]
      }
    | {
          el: 'ellipse'
          cx: number
          cy: number
          rx: number
          ry: number
          m: string[]
      }
    | { el: 'path'; d: string; dm?: string; m: string[] }

export const MUSCLE_MAP_VIEWBOX = '0 0 100 186'

// Each view is authored as its spine-aligned `center` shapes plus the left-hand
// `side` shapes; the side set is drawn again mirrored across x=50 to make the
// right half, so the body stays symmetric without duplicating coordinates.
function mirror(s: MuscleMapShape): MuscleMapShape {
    if (s.el === 'rect') return { ...s, x: 100 - s.x - s.w }
    if (s.el === 'ellipse') return { ...s, cx: 100 - s.cx }
    return { ...s, d: s.dm ?? s.d }
}

const front: { center: MuscleMapShape[]; side: MuscleMapShape[] } = {
    center: [
        { el: 'ellipse', cx: 50, cy: 18, rx: 11, ry: 12, m: [] },
        { el: 'rect', x: 44, y: 28, w: 12, h: 7, rx: 2, m: [] },
        { el: 'rect', x: 42, y: 66, w: 16, h: 23, rx: 2, m: ['abs'] },
        { el: 'rect', x: 39, y: 89, w: 22, h: 9, rx: 3, m: [] },
    ],
    side: [
        { el: 'ellipse', cx: 24, cy: 46, rx: 5, ry: 8, m: ['side delts'] },
        { el: 'ellipse', cx: 33, cy: 45, rx: 8, ry: 8, m: ['front delts'] },
        {
            el: 'path',
            d: 'M47 31 L40 42 L47 40 Z',
            dm: 'M53 31 L60 42 L53 40 Z',
            m: ['traps'],
        },
        { el: 'rect', x: 36, y: 39, w: 12, h: 9, rx: 2, m: ['upper chest'] },
        { el: 'rect', x: 35, y: 48, w: 13, h: 11, rx: 2, m: ['chest'] },
        { el: 'rect', x: 37, y: 59, w: 11, h: 5, rx: 2, m: ['lower chest'] },
        {
            el: 'rect',
            x: 20,
            y: 50,
            w: 9,
            h: 19,
            rx: 4,
            m: ['biceps', 'brachialis'],
        },
        { el: 'rect', x: 18, y: 70, w: 9, h: 23, rx: 4, m: ['forearms'] },
        { el: 'rect', x: 35, y: 66, w: 6, h: 21, rx: 3, m: ['obliques'] },
        { el: 'rect', x: 37, y: 99, w: 11, h: 37, rx: 5, m: ['quads'] },
        { el: 'rect', x: 38, y: 137, w: 11, h: 7, rx: 3, m: [] },
        { el: 'rect', x: 39, y: 145, w: 9, h: 28, rx: 4, m: ['calves'] },
        { el: 'rect', x: 39, y: 174, w: 10, h: 7, rx: 2, m: [] },
    ],
}

const back: { center: MuscleMapShape[]; side: MuscleMapShape[] } = {
    center: [
        { el: 'ellipse', cx: 50, cy: 18, rx: 11, ry: 12, m: [] },
        { el: 'rect', x: 44, y: 28, w: 12, h: 7, rx: 2, m: [] },
        {
            el: 'path',
            d: 'M50 32 L40 40 L43 55 L50 59 L57 55 L60 40 Z',
            m: ['traps'],
        },
        { el: 'rect', x: 43, y: 84, w: 14, h: 11, rx: 2, m: ['lower back'] },
    ],
    side: [
        { el: 'ellipse', cx: 24, cy: 46, rx: 5, ry: 8, m: ['side delts'] },
        { el: 'ellipse', cx: 33, cy: 45, rx: 8, ry: 8, m: ['rear delts'] },
        { el: 'rect', x: 41, y: 56, w: 7, h: 12, rx: 2, m: ['rhomboids'] },
        {
            el: 'path',
            d: 'M48 57 L37 62 L41 84 L48 87 Z',
            dm: 'M52 57 L63 62 L59 84 L52 87 Z',
            m: ['lats'],
        },
        { el: 'rect', x: 20, y: 50, w: 9, h: 19, rx: 4, m: ['triceps'] },
        { el: 'rect', x: 18, y: 70, w: 9, h: 23, rx: 4, m: ['forearms'] },
        { el: 'rect', x: 38, y: 92, w: 11, h: 16, rx: 5, m: ['glutes'] },
        { el: 'rect', x: 37, y: 110, w: 11, h: 29, rx: 5, m: ['hamstrings'] },
        { el: 'rect', x: 38, y: 139, w: 11, h: 6, rx: 3, m: [] },
        { el: 'rect', x: 39, y: 145, w: 9, h: 28, rx: 4, m: ['calves'] },
        { el: 'rect', x: 39, y: 174, w: 10, h: 7, rx: 2, m: [] },
    ],
}

export const frontShapes: MuscleMapShape[] = [
    ...front.center,
    ...front.side,
    ...front.side.map(mirror),
]
export const backShapes: MuscleMapShape[] = [
    ...back.center,
    ...back.side,
    ...back.side.map(mirror),
]

export const frontMuscleNames = new Set(frontShapes.flatMap((s) => s.m))

// Collapse an exercise's muscles to one intensity each (an exercise lists a
// muscle once, but keep the strongest if it ever repeats).
export function muscleIntensities(muscles: MuscleTarget[]) {
    const map: Record<string, MuscleIntensity> = {}
    for (const t of muscles) {
        const current = map[t.muscle]
        if (!current || intensityRank[t.intensity] > intensityRank[current]) {
            map[t.muscle] = t.intensity
        }
    }
    return map
}

// A region can stand for more than one muscle name (e.g. the upper arm covers
// both biceps and brachialis); it lights to the strongest one worked.
export function mapRegionClass(
    names: string[],
    byMuscle: Record<string, MuscleIntensity>,
) {
    let best: MuscleIntensity | null = null
    for (const name of names) {
        const intensity = byMuscle[name]
        if (
            intensity
            && (!best || intensityRank[intensity] > intensityRank[best])
        ) {
            best = intensity
        }
    }
    return [REGION_BASE, REGION_FILL[best ?? 'off']]
}

const REGION_BASE = '[stroke-width:0.8] transition-[fill] duration-150'

// Region fill encodes how hard the muscle works: full accent = prime mover,
// mixed = secondary, faint = assists, surface = untouched.
const REGION_FILL: Record<MuscleIntensity | 'off', string> = {
    off: 'fill-surface-2 stroke-line-2',
    low: 'fill-muscle-low stroke-muscle-low-edge',
    medium: 'fill-muscle-med stroke-muscle-med-edge',
    high: 'fill-accent stroke-accent',
}
