/**
 * The exercise catalog: immutable, shipped with the app, grown in this file.
 *
 * Deliberately small — common lifts, not a census. The standing rule while the
 * user base is one person is *grow the catalog, never a custom, for a real
 * exercise*: a missing movement gets a slug here rather than a custom on the
 * phone, because a custom logged for weeks forks its own history the day the
 * catalog grows the real entry, and nothing merges.
 *
 * Rules the data answers to:
 *
 * - **Slugs are forever.** Fields may be fixed; a slug is never deleted or
 *   reused. Workout records carry these ids for good.
 * - **Variant or alias.** Different load or emphasis → its own entry with
 *   `variantOf` (close-grip pulldown). Same movement, another name → an alias
 *   (military press). The hint system is why: hints never cross entries, so an
 *   entry split too fine costs a cold start, and one merged too coarse makes
 *   the hint lie.
 * - **Load mode is math, not description.** Volume multiplies by 2 for
 *   `per-hand` and `unilateral`, so a wrong default here corrupts stats
 *   silently. Weight on a per-hand entry means *one* dumbbell; on unilateral,
 *   reps are per side.
 * - **No descriptions, no photos, no video, ever** (PRODUCT.md). The one
 *   visual is a bundled line-art SVG per entry in `static/illustrations/`,
 *   keyed by id — and an entry may ship without one.
 */

import type { Exercise } from '$lib/domain/exercise';

export const catalog: Exercise[] = [
	// Chest
	{
		id: 'bench-press',
		name: 'Bench Press',
		aliases: ['bp', 'flat bench'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] }
	},
	{
		id: 'close-grip-bench-press',
		name: 'Close-Grip Bench Press',
		aliases: ['cgbp', 'close grip bench'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: ['Chest', 'Shoulders'] },
		variantOf: 'bench-press'
	},
	{
		id: 'incline-bench-press',
		name: 'Incline Bench Press',
		aliases: ['incline barbell press'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Shoulders', 'Triceps'] },
		variantOf: 'bench-press'
	},
	{
		id: 'dumbbell-bench-press',
		name: 'Dumbbell Bench Press',
		aliases: ['db bench', 'dumbbell press'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] }
	},
	{
		id: 'incline-dumbbell-press',
		name: 'Incline DB Press',
		aliases: ['incline dumbbell press'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: ['Shoulders', 'Triceps'] },
		variantOf: 'dumbbell-bench-press'
	},
	{
		id: 'cable-fly',
		name: 'Cable Fly',
		aliases: ['cable crossover', 'crossover'],
		equipment: 'Cable',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: [] }
	},
	{
		id: 'pec-deck',
		name: 'Pec Deck',
		aliases: ['butterfly', 'chest fly machine'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: [] }
	},
	{
		id: 'push-up',
		name: 'Push-Up',
		aliases: ['pushup', 'press up'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders', 'Core'] }
	},

	// Back
	{
		id: 'deadlift',
		name: 'Deadlift',
		aliases: ['dl', 'conventional deadlift'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Glutes', 'Hamstrings', 'Forearms', 'Core'] }
	},
	{
		id: 'sumo-deadlift',
		name: 'Sumo Deadlift',
		aliases: ['sumo'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings', 'Back', 'Quads'] },
		variantOf: 'deadlift'
	},
	{
		id: 'pull-up',
		name: 'Pull-Up',
		aliases: ['pullup'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] }
	},
	{
		id: 'chin-up',
		name: 'Chin-Up',
		aliases: ['chinup', 'supinated pull-up'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] },
		variantOf: 'pull-up'
	},
	{
		id: 'lat-pulldown',
		name: 'Lat Pulldown',
		aliases: ['pulldown'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] }
	},
	{
		id: 'close-grip-lat-pulldown',
		name: 'Close-Grip Lat Pulldown',
		aliases: ['close grip pulldown', 'neutral grip pulldown'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] },
		variantOf: 'lat-pulldown'
	},
	{
		id: 'wide-grip-lat-pulldown',
		name: 'Wide-Grip Lat Pulldown',
		aliases: ['wide grip pulldown'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] },
		variantOf: 'lat-pulldown'
	},
	{
		id: 'barbell-row',
		name: 'Barbell Row',
		aliases: ['bent over row', 'bor'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] }
	},
	{
		id: 'seated-cable-row',
		name: 'Seated Cable Row',
		aliases: ['cable row', 'low row'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] }
	},
	{
		id: 'dumbbell-row',
		name: 'Dumbbell Row',
		aliases: ['one arm row', 'db row', 'single arm row'],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] }
	},

	// Shoulders
	{
		id: 'overhead-press',
		name: 'Overhead Press',
		aliases: ['ohp', 'military press', 'shoulder press'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Triceps', 'Core'] }
	},
	{
		id: 'seated-dumbbell-press',
		name: 'Seated DB Press',
		aliases: ['db shoulder press', 'seated dumbbell press'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: ['Triceps'] }
	},
	{
		id: 'lateral-raise',
		name: 'Lateral Raise',
		aliases: ['side raise', 'side lateral'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: [] }
	},
	{
		id: 'rear-delt-fly',
		name: 'Rear Delt Fly',
		aliases: ['reverse fly', 'rear delt raise'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: ['Back'] }
	},
	{
		id: 'face-pull',
		name: 'Face Pull',
		aliases: ['facepull'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Back'] }
	},

	// Biceps
	{
		id: 'barbell-curl',
		name: 'Barbell Curl',
		aliases: ['bb curl', 'ez bar curl'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] }
	},
	{
		id: 'dumbbell-curl',
		name: 'Dumbbell Curl',
		aliases: ['db curl', 'bicep curl'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] }
	},
	{
		id: 'hammer-curl',
		name: 'Hammer Curl',
		aliases: ['neutral grip curl'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] }
	},
	{
		id: 'preacher-curl',
		name: 'Preacher Curl',
		aliases: ['preacher'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: [] }
	},
	{
		id: 'cable-curl',
		name: 'Cable Curl',
		aliases: ['rope curl'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] }
	},

	// Triceps
	{
		id: 'triceps-pushdown',
		name: 'Triceps Pushdown',
		aliases: ['pushdown', 'rope pushdown', 'cable pushdown'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: [] }
	},
	{
		id: 'overhead-triceps-extension',
		name: 'Overhead Triceps Extension',
		aliases: ['overhead extension', 'french press'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: [] }
	},
	{
		id: 'skull-crusher',
		name: 'Skull Crusher',
		aliases: ['lying triceps extension', 'skullcrusher'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: [] }
	},
	{
		id: 'dip',
		name: 'Dip',
		aliases: ['dips', 'parallel bar dip'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: ['Chest', 'Shoulders'] }
	},

	// Core
	{
		id: 'plank',
		name: 'Plank',
		aliases: ['front plank'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		muscles: { primary: 'Core', secondary: [] }
	},
	{
		id: 'cable-crunch',
		name: 'Cable Crunch',
		aliases: ['kneeling crunch', 'rope crunch'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Core', secondary: [] }
	},
	{
		id: 'hanging-leg-raise',
		name: 'Hanging Leg Raise',
		aliases: ['leg raise', 'hanging knee raise'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		muscles: { primary: 'Core', secondary: ['Forearms'] }
	},

	// Quads
	{
		id: 'squat',
		name: 'Squat',
		aliases: ['back squat', 'barbell squat'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings', 'Core'] }
	},
	{
		id: 'front-squat',
		name: 'Front Squat',
		aliases: [],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Core'] },
		variantOf: 'squat'
	},
	{
		id: 'leg-press',
		name: 'Leg Press',
		aliases: [],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings'] }
	},
	{
		id: 'leg-extension',
		name: 'Leg Extension',
		aliases: ['quad extension'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: [] }
	},
	{
		id: 'bulgarian-split-squat',
		name: 'Bulgarian Split Squat',
		aliases: ['bss', 'split squat'],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Quads', secondary: ['Glutes'] }
	},
	{
		id: 'lunge',
		name: 'Lunge',
		aliases: ['walking lunge', 'lunges'],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings'] }
	},

	// Hamstrings
	{
		id: 'romanian-deadlift',
		name: 'Romanian Deadlift',
		aliases: ['rdl', 'stiff leg deadlift'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: ['Glutes', 'Back'] }
	},
	{
		id: 'leg-curl',
		name: 'Leg Curl',
		aliases: ['lying leg curl', 'seated leg curl', 'hamstring curl'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: [] }
	},

	// Glutes
	{
		id: 'hip-thrust',
		name: 'Hip Thrust',
		aliases: ['glute bridge', 'barbell hip thrust'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings'] }
	},

	// Calves
	{
		id: 'standing-calf-raise',
		name: 'Standing Calf Raise',
		aliases: ['calf raise'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Calves', secondary: [] }
	},
	{
		id: 'seated-calf-raise',
		name: 'Seated Calf Raise',
		aliases: [],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Calves', secondary: [] }
	}
];

/** The join the screens use: a workout knows a slug, a row needs the entry. */
export const catalogById: Record<string, Exercise> = Object.fromEntries(
	catalog.map((exercise) => [exercise.id, exercise])
);
