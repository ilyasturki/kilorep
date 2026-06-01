import type { NewExercise } from './schema'

/**
 * Default exercise catalog injected into the `exercises` table on first
 * startup. Ordered by muscle group as authored; edit freely — the seed step
 * inserts any new entries on the next launch and leaves existing rows alone.
 */
export const EXERCISE_CATALOG: NewExercise[] = [
    // chest
    { name: 'bench press', muscles: 'chest' },
    { name: 'bench press inclined', muscles: 'chest' },
    { name: 'bench press declined', muscles: 'chest' },
    { name: 'bench press dumbbell', muscles: 'chest' },
    { name: 'bench press dumbbell 15°', muscles: 'chest' },
    { name: 'bench press dumbbell 30°', muscles: 'chest' },
    { name: 'bench press machine', muscles: 'chest' },
    { name: 'pec fly bench', muscles: 'chest' },
    { name: 'pec deck', muscles: 'chest' },
    { name: 'pec deck machine', muscles: 'chest' },
    { name: 'chest press', muscles: 'chest' },
    { name: 'chest press inclined', muscles: 'chest' },
    { name: 'dips large', muscles: 'chest' },

    // triceps
    { name: 'dips', muscles: 'triceps' },
    { name: 'dips machine', muscles: 'triceps' },
    { name: 'cable overhead triceps', muscles: 'triceps' },
    { name: 'cable overhead triceps rope', muscles: 'triceps' },
    { name: 'dumbell overhead triceps', muscles: 'triceps' },
    { name: 'skullcrusher', muscles: 'triceps' },
    { name: 'cable triceps extension', muscles: 'triceps' },
    { name: 'cable triceps extension rope', muscles: 'triceps' },
    { name: 'cable triceps kickback', muscles: 'triceps' },

    // shoulders
    { name: 'shoulder press dumbbell', muscles: 'shoulders' },
    { name: 'shoulder press machine', muscles: 'shoulders' },
    { name: 'shoulder press barbell', muscles: 'shoulders' },
    { name: 'lateral raise cable', muscles: 'shoulders' },
    { name: 'lateral raise dumbell', muscles: 'shoulders' },
    { name: 'reverse butterfly', muscles: 'shoulders' },
    { name: 'reverse butterfly dumbell', muscles: 'shoulders' },
    { name: 'cable reverse butterfly unilateral', muscles: 'shoulders' },
    { name: 'face pull', muscles: 'shoulders' },

    // back
    { name: 'pull up pronated', muscles: 'back' },
    { name: 'pull up neutral', muscles: 'back' },
    { name: 'pull up wide', muscles: 'back' },
    { name: 'pull up supinated', muscles: 'back' },
    { name: 'lat pulldown pronated', muscles: 'back' },
    { name: 'lat pulldown neutral', muscles: 'back' },
    { name: 'lat pulldown wide', muscles: 'back' },
    { name: 'lat pulldown close', muscles: 'back' },
    { name: 'lat pulldown machine', muscles: 'back' },
    { name: 'lat pulldown supinated', muscles: 'back' },
    { name: 'lat pulldown cbum', muscles: 'back' },
    { name: 'rowing barbell', muscles: 'back' },
    { name: 'rowing cable', muscles: 'back' },
    { name: 'rowing cable wide', muscles: 'back' },
    { name: 'rowing machine', muscles: 'back' },
    { name: 'rowing machine wide', muscles: 'back' },
    { name: 'rowing machine 2', muscles: 'back' },
    { name: 'rowing machine 2 wide', muscles: 'back' },
    { name: 't bar row', muscles: 'back' },
    { name: 'unilateral rowing', muscles: 'back' },
    { name: 'pullover cable', muscles: 'back' },

    // biceps
    { name: '21s biceps curl barbell', muscles: 'biceps' },
    { name: '21s biceps curl dumbell', muscles: 'biceps' },
    { name: 'biceps curl barbell', muscles: 'biceps' },
    { name: 'biceps curl machine', muscles: 'biceps' },
    { name: 'larry scott', muscles: 'biceps' },
    { name: 'hammer curl', muscles: 'biceps' },
    { name: 'incline curl dumbell', muscles: 'biceps' },
    { name: 'cable curl', muscles: 'biceps' },

    // quads
    { name: 'squat', muscles: 'quads' },
    { name: 'hack squat', muscles: 'quads' },
    { name: 'squat smith machine', muscles: 'quads' },
    { name: 'bulgarian split squat', muscles: 'quads' },

    // glutes
    { name: 'deadlift', muscles: 'glutes' },
    { name: 'romanian deadlift', muscles: 'glutes' },
    { name: 'deadlift machine', muscles: 'glutes' },

    // quads
    { name: 'leg press', muscles: 'quads' },
    { name: 'leg extension', muscles: 'quads' },

    // glutes
    { name: 'leg curl seated', muscles: 'glutes' },
    { name: 'leg curl lying', muscles: 'glutes' },

    // calves
    { name: 'calf standing', muscles: 'calves' },
    { name: 'calf seated', muscles: 'calves' },

    // glutes
    { name: 'hip thrust', muscles: 'glutes' },
]
