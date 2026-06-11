import type { NewExercise } from './schema'

/**
 * Default exercise catalog seeded into the `exercises` table on first startup.
 *
 * Curated to common gym movements only, grouped by the primary region they
 * train. Each entry records its main piece of equipment, whether it is a
 * compound or isolation movement, and the muscles it works with a relative
 * intensity (`high` = prime mover, `medium`/`low` = assisting). Muscle names
 * use specific heads (e.g. `upper chest`, `side delts`) so a flat bench and an
 * incline press, or a bench press and a pec fly, read differently.
 *
 * This list is APPEND-ONLY. The seeder tracks how far into it each database
 * has been offered (the `catalogCursor` row in `meta`) and only applies
 * entries past that point, so defaults a user deleted are never re-inserted.
 * Add new exercises at the very end — even when that breaks the region
 * grouping — and never reorder, remove, or rename entries in place; treat a
 * rename as appending a new entry.
 *
 * `aliases` lists other names a movement is commonly known by; the exercise
 * picker searches them alongside `name`. Append-only applies here too:
 * editing aliases on an already-shipped entry only reaches NEW users' copies,
 * so pair such an edit with a name-matching backfill migration (see 0010).
 */
export const EXERCISE_CATALOG: Omit<NewExercise, 'userId'>[] = [
    // ── Chest ────────────────────────────────────────────────────────────────
    {
        name: 'Barbell Bench Press',
        aliases: ['Flat Bench Press'],
        equipment: 'barbell',
        type: 'compound',
        muscles: [
            { muscle: 'chest', intensity: 'high' },
            { muscle: 'front delts', intensity: 'medium' },
            { muscle: 'triceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Incline Barbell Bench Press',
        equipment: 'barbell',
        type: 'compound',
        muscles: [
            { muscle: 'upper chest', intensity: 'high' },
            { muscle: 'front delts', intensity: 'medium' },
            { muscle: 'triceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Dumbbell Bench Press',
        equipment: 'dumbbell',
        type: 'compound',
        muscles: [
            { muscle: 'chest', intensity: 'high' },
            { muscle: 'front delts', intensity: 'medium' },
            { muscle: 'triceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Incline Dumbbell Bench Press',
        equipment: 'dumbbell',
        type: 'compound',
        muscles: [
            { muscle: 'upper chest', intensity: 'high' },
            { muscle: 'front delts', intensity: 'medium' },
            { muscle: 'triceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Machine Chest Press',
        equipment: 'machine',
        type: 'compound',
        muscles: [
            { muscle: 'chest', intensity: 'high' },
            { muscle: 'front delts', intensity: 'low' },
            { muscle: 'triceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Incline Machine Chest Press',
        equipment: 'machine',
        type: 'compound',
        muscles: [
            { muscle: 'upper chest', intensity: 'high' },
            { muscle: 'front delts', intensity: 'low' },
            { muscle: 'triceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Pec Deck Fly',
        aliases: ['Butterfly', 'Machine Fly'],
        equipment: 'machine',
        type: 'isolation',
        muscles: [
            { muscle: 'chest', intensity: 'high' },
            { muscle: 'front delts', intensity: 'low' },
        ],
    },
    {
        name: 'Cable Fly',
        aliases: ['Cable Crossover'],
        equipment: 'cable',
        type: 'isolation',
        muscles: [
            { muscle: 'chest', intensity: 'high' },
            { muscle: 'front delts', intensity: 'low' },
        ],
    },
    {
        name: 'Incline Cable Fly',
        equipment: 'cable',
        type: 'isolation',
        muscles: [
            { muscle: 'upper chest', intensity: 'high' },
            { muscle: 'front delts', intensity: 'low' },
        ],
    },
    {
        name: 'Dumbbell Fly',
        equipment: 'dumbbell',
        type: 'isolation',
        muscles: [
            { muscle: 'chest', intensity: 'high' },
            { muscle: 'front delts', intensity: 'low' },
        ],
    },
    {
        name: 'Push-Up',
        aliases: ['Press-Up'],
        equipment: 'bodyweight',
        type: 'compound',
        muscles: [
            { muscle: 'chest', intensity: 'high' },
            { muscle: 'triceps', intensity: 'medium' },
            { muscle: 'front delts', intensity: 'medium' },
        ],
    },
    {
        name: 'Chest Dip',
        equipment: 'bodyweight',
        type: 'compound',
        muscles: [
            { muscle: 'lower chest', intensity: 'high' },
            { muscle: 'triceps', intensity: 'high' },
            { muscle: 'front delts', intensity: 'medium' },
        ],
    },

    // ── Shoulders ────────────────────────────────────────────────────────────
    {
        name: 'Overhead Press',
        aliases: ['Military Press', 'Barbell Shoulder Press'],
        equipment: 'barbell',
        type: 'compound',
        muscles: [
            { muscle: 'front delts', intensity: 'high' },
            { muscle: 'side delts', intensity: 'medium' },
            { muscle: 'triceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Dumbbell Shoulder Press',
        equipment: 'dumbbell',
        type: 'compound',
        muscles: [
            { muscle: 'front delts', intensity: 'high' },
            { muscle: 'side delts', intensity: 'medium' },
            { muscle: 'triceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Machine Shoulder Press',
        equipment: 'machine',
        type: 'compound',
        muscles: [
            { muscle: 'front delts', intensity: 'high' },
            { muscle: 'side delts', intensity: 'medium' },
            { muscle: 'triceps', intensity: 'low' },
        ],
    },
    {
        name: 'Arnold Press',
        equipment: 'dumbbell',
        type: 'compound',
        muscles: [
            { muscle: 'front delts', intensity: 'high' },
            { muscle: 'side delts', intensity: 'medium' },
            { muscle: 'triceps', intensity: 'low' },
        ],
    },
    {
        name: 'Dumbbell Lateral Raise',
        aliases: ['Side Raise'],
        equipment: 'dumbbell',
        type: 'isolation',
        muscles: [{ muscle: 'side delts', intensity: 'high' }],
    },
    {
        name: 'Cable Lateral Raise',
        equipment: 'cable',
        type: 'isolation',
        muscles: [{ muscle: 'side delts', intensity: 'high' }],
    },
    {
        name: 'Machine Lateral Raise',
        equipment: 'machine',
        type: 'isolation',
        muscles: [{ muscle: 'side delts', intensity: 'high' }],
    },
    {
        name: 'Reverse Pec Deck',
        aliases: ['Machine Reverse Fly'],
        equipment: 'machine',
        type: 'isolation',
        muscles: [
            { muscle: 'rear delts', intensity: 'high' },
            { muscle: 'rhomboids', intensity: 'medium' },
        ],
    },
    {
        name: 'Dumbbell Rear Delt Fly',
        aliases: ['Reverse Fly', 'Bent-Over Lateral Raise'],
        equipment: 'dumbbell',
        type: 'isolation',
        muscles: [
            { muscle: 'rear delts', intensity: 'high' },
            { muscle: 'rhomboids', intensity: 'medium' },
        ],
    },
    {
        name: 'Face Pull',
        equipment: 'cable',
        type: 'isolation',
        muscles: [
            { muscle: 'rear delts', intensity: 'high' },
            { muscle: 'traps', intensity: 'medium' },
        ],
    },
    {
        name: 'Barbell Shrug',
        equipment: 'barbell',
        type: 'isolation',
        muscles: [{ muscle: 'traps', intensity: 'high' }],
    },
    {
        name: 'Dumbbell Shrug',
        equipment: 'dumbbell',
        type: 'isolation',
        muscles: [{ muscle: 'traps', intensity: 'high' }],
    },

    // ── Back ─────────────────────────────────────────────────────────────────
    {
        name: 'Deadlift',
        aliases: ['Conventional Deadlift'],
        equipment: 'barbell',
        type: 'compound',
        muscles: [
            { muscle: 'lower back', intensity: 'high' },
            { muscle: 'glutes', intensity: 'high' },
            { muscle: 'hamstrings', intensity: 'high' },
            { muscle: 'traps', intensity: 'medium' },
            { muscle: 'lats', intensity: 'medium' },
        ],
    },
    {
        name: 'Pull-Up',
        equipment: 'bodyweight',
        type: 'compound',
        muscles: [
            { muscle: 'lats', intensity: 'high' },
            { muscle: 'rhomboids', intensity: 'medium' },
            { muscle: 'biceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Chin-Up',
        equipment: 'bodyweight',
        type: 'compound',
        muscles: [
            { muscle: 'lats', intensity: 'high' },
            { muscle: 'biceps', intensity: 'high' },
            { muscle: 'rhomboids', intensity: 'medium' },
        ],
    },
    {
        name: 'Lat Pulldown',
        equipment: 'cable',
        type: 'compound',
        muscles: [
            { muscle: 'lats', intensity: 'high' },
            { muscle: 'rhomboids', intensity: 'medium' },
            { muscle: 'biceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Close-Grip Lat Pulldown',
        equipment: 'cable',
        type: 'compound',
        muscles: [
            { muscle: 'lats', intensity: 'high' },
            { muscle: 'biceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Barbell Row',
        aliases: ['Bent-Over Row'],
        equipment: 'barbell',
        type: 'compound',
        muscles: [
            { muscle: 'lats', intensity: 'high' },
            { muscle: 'rhomboids', intensity: 'high' },
            { muscle: 'traps', intensity: 'medium' },
            { muscle: 'biceps', intensity: 'medium' },
            { muscle: 'lower back', intensity: 'medium' },
        ],
    },
    {
        name: 'Dumbbell Row',
        aliases: ['One-Arm Dumbbell Row'],
        equipment: 'dumbbell',
        type: 'compound',
        muscles: [
            { muscle: 'lats', intensity: 'high' },
            { muscle: 'rhomboids', intensity: 'medium' },
            { muscle: 'biceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Seated Cable Row',
        equipment: 'cable',
        type: 'compound',
        muscles: [
            { muscle: 'lats', intensity: 'high' },
            { muscle: 'rhomboids', intensity: 'high' },
            { muscle: 'biceps', intensity: 'medium' },
        ],
    },
    {
        name: 'T-Bar Row',
        equipment: 'machine',
        type: 'compound',
        muscles: [
            { muscle: 'lats', intensity: 'high' },
            { muscle: 'rhomboids', intensity: 'high' },
            { muscle: 'traps', intensity: 'medium' },
            { muscle: 'biceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Machine Row',
        equipment: 'machine',
        type: 'compound',
        muscles: [
            { muscle: 'lats', intensity: 'high' },
            { muscle: 'rhomboids', intensity: 'high' },
            { muscle: 'biceps', intensity: 'medium' },
        ],
    },
    {
        name: 'Straight-Arm Pulldown',
        aliases: ['Cable Pullover', 'Lat Prayer'],
        equipment: 'cable',
        type: 'isolation',
        muscles: [{ muscle: 'lats', intensity: 'high' }],
    },

    // ── Biceps ───────────────────────────────────────────────────────────────
    {
        name: 'Barbell Curl',
        equipment: 'barbell',
        type: 'isolation',
        muscles: [
            { muscle: 'biceps', intensity: 'high' },
            { muscle: 'forearms', intensity: 'low' },
        ],
    },
    {
        name: 'Dumbbell Curl',
        equipment: 'dumbbell',
        type: 'isolation',
        muscles: [
            { muscle: 'biceps', intensity: 'high' },
            { muscle: 'forearms', intensity: 'low' },
        ],
    },
    {
        name: 'Hammer Curl',
        aliases: ['Neutral-Grip Curl'],
        equipment: 'dumbbell',
        type: 'isolation',
        muscles: [
            { muscle: 'brachialis', intensity: 'high' },
            { muscle: 'biceps', intensity: 'medium' },
            { muscle: 'forearms', intensity: 'medium' },
        ],
    },
    {
        name: 'Incline Dumbbell Curl',
        equipment: 'dumbbell',
        type: 'isolation',
        muscles: [{ muscle: 'biceps', intensity: 'high' }],
    },
    {
        name: 'Preacher Curl',
        aliases: ['Scott Curl'],
        equipment: 'machine',
        type: 'isolation',
        muscles: [{ muscle: 'biceps', intensity: 'high' }],
    },
    {
        name: 'Cable Curl',
        equipment: 'cable',
        type: 'isolation',
        muscles: [
            { muscle: 'biceps', intensity: 'high' },
            { muscle: 'forearms', intensity: 'low' },
        ],
    },

    // ── Triceps ──────────────────────────────────────────────────────────────
    {
        name: 'Close-Grip Bench Press',
        equipment: 'barbell',
        type: 'compound',
        muscles: [
            { muscle: 'triceps', intensity: 'high' },
            { muscle: 'chest', intensity: 'medium' },
            { muscle: 'front delts', intensity: 'low' },
        ],
    },
    {
        name: 'Triceps Dip',
        equipment: 'bodyweight',
        type: 'compound',
        muscles: [
            { muscle: 'triceps', intensity: 'high' },
            { muscle: 'chest', intensity: 'medium' },
            { muscle: 'front delts', intensity: 'low' },
        ],
    },
    {
        name: 'Cable Triceps Pushdown',
        aliases: ['Triceps Pressdown', 'Rope Pushdown'],
        equipment: 'cable',
        type: 'isolation',
        muscles: [{ muscle: 'triceps', intensity: 'high' }],
    },
    {
        name: 'Overhead Cable Triceps Extension',
        equipment: 'cable',
        type: 'isolation',
        muscles: [{ muscle: 'triceps', intensity: 'high' }],
    },
    {
        name: 'Overhead Dumbbell Triceps Extension',
        equipment: 'dumbbell',
        type: 'isolation',
        muscles: [{ muscle: 'triceps', intensity: 'high' }],
    },
    {
        name: 'Skull Crusher',
        aliases: ['Lying Triceps Extension', 'French Press'],
        equipment: 'barbell',
        type: 'isolation',
        muscles: [{ muscle: 'triceps', intensity: 'high' }],
    },

    // ── Quads ────────────────────────────────────────────────────────────────
    {
        name: 'Back Squat',
        aliases: ['Barbell Squat'],
        equipment: 'barbell',
        type: 'compound',
        muscles: [
            { muscle: 'quads', intensity: 'high' },
            { muscle: 'glutes', intensity: 'high' },
            { muscle: 'hamstrings', intensity: 'medium' },
            { muscle: 'lower back', intensity: 'medium' },
        ],
    },
    {
        name: 'Front Squat',
        equipment: 'barbell',
        type: 'compound',
        muscles: [
            { muscle: 'quads', intensity: 'high' },
            { muscle: 'glutes', intensity: 'medium' },
            { muscle: 'lower back', intensity: 'medium' },
        ],
    },
    {
        name: 'Hack Squat',
        equipment: 'machine',
        type: 'compound',
        muscles: [
            { muscle: 'quads', intensity: 'high' },
            { muscle: 'glutes', intensity: 'medium' },
        ],
    },
    {
        name: 'Leg Press',
        equipment: 'machine',
        type: 'compound',
        muscles: [
            { muscle: 'quads', intensity: 'high' },
            { muscle: 'glutes', intensity: 'high' },
            { muscle: 'hamstrings', intensity: 'medium' },
        ],
    },
    {
        name: 'Bulgarian Split Squat',
        aliases: ['Rear-Foot-Elevated Split Squat'],
        equipment: 'dumbbell',
        type: 'compound',
        muscles: [
            { muscle: 'quads', intensity: 'high' },
            { muscle: 'glutes', intensity: 'high' },
            { muscle: 'hamstrings', intensity: 'medium' },
        ],
    },
    {
        name: 'Walking Lunge',
        equipment: 'dumbbell',
        type: 'compound',
        muscles: [
            { muscle: 'quads', intensity: 'high' },
            { muscle: 'glutes', intensity: 'high' },
            { muscle: 'hamstrings', intensity: 'medium' },
        ],
    },
    {
        name: 'Leg Extension',
        equipment: 'machine',
        type: 'isolation',
        muscles: [{ muscle: 'quads', intensity: 'high' }],
    },

    // ── Hamstrings & Glutes ──────────────────────────────────────────────────
    {
        name: 'Romanian Deadlift',
        equipment: 'barbell',
        type: 'compound',
        muscles: [
            { muscle: 'hamstrings', intensity: 'high' },
            { muscle: 'glutes', intensity: 'high' },
            { muscle: 'lower back', intensity: 'medium' },
        ],
    },
    {
        name: 'Seated Leg Curl',
        aliases: ['Seated Hamstring Curl'],
        equipment: 'machine',
        type: 'isolation',
        muscles: [{ muscle: 'hamstrings', intensity: 'high' }],
    },
    {
        name: 'Lying Leg Curl',
        aliases: ['Lying Hamstring Curl'],
        equipment: 'machine',
        type: 'isolation',
        muscles: [{ muscle: 'hamstrings', intensity: 'high' }],
    },
    {
        name: 'Hip Thrust',
        equipment: 'barbell',
        type: 'compound',
        muscles: [
            { muscle: 'glutes', intensity: 'high' },
            { muscle: 'hamstrings', intensity: 'medium' },
        ],
    },
    {
        name: 'Hip Abduction',
        aliases: ['Abductor Machine'],
        equipment: 'machine',
        type: 'isolation',
        muscles: [{ muscle: 'glutes', intensity: 'high' }],
    },

    // ── Calves ───────────────────────────────────────────────────────────────
    {
        name: 'Standing Calf Raise',
        equipment: 'machine',
        type: 'isolation',
        muscles: [{ muscle: 'calves', intensity: 'high' }],
    },
    {
        name: 'Seated Calf Raise',
        equipment: 'machine',
        type: 'isolation',
        muscles: [{ muscle: 'calves', intensity: 'high' }],
    },

    // ── Core ─────────────────────────────────────────────────────────────────
    {
        name: 'Hanging Leg Raise',
        equipment: 'bodyweight',
        type: 'isolation',
        muscles: [
            { muscle: 'abs', intensity: 'high' },
            { muscle: 'obliques', intensity: 'low' },
        ],
    },
    {
        name: 'Cable Crunch',
        aliases: ['Rope Crunch'],
        equipment: 'cable',
        type: 'isolation',
        muscles: [{ muscle: 'abs', intensity: 'high' }],
    },
    {
        name: 'Plank',
        equipment: 'bodyweight',
        type: 'isolation',
        muscles: [
            { muscle: 'abs', intensity: 'high' },
            { muscle: 'obliques', intensity: 'medium' },
        ],
    },
    {
        name: 'Russian Twist',
        equipment: 'bodyweight',
        type: 'isolation',
        muscles: [
            { muscle: 'obliques', intensity: 'high' },
            { muscle: 'abs', intensity: 'medium' },
        ],
    },
]
