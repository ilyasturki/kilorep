import type { Exercise } from '~~/server/database/schema'

// Aliases and muscle names join the exercise name as search terms, so typing
// "chest" surfaces every exercise that works it, not only those named after
// it. Shared by the combobox and the catalog page so searching behaves
// identically everywhere.
export const exerciseSearchKeywords = (
    exercise: Pick<Exercise, 'aliases' | 'muscles'>,
) => [...exercise.aliases, ...exercise.muscles.map((m) => m.muscle)]
