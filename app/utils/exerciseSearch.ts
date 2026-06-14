import type { Exercise } from '~~/server/database/schema'

// Aliases join the exercise name as fuzzy-search terms, so an alternate name
// ("pec deck") still finds the canonical one ("Butterfly Machine"). Shared by
// the combobox and the catalog page so searching behaves identically. Muscles
// are intentionally not searchable — they're shown as badges, not typed.
export const exerciseSearchKeywords = (exercise: Pick<Exercise, 'aliases'>) =>
    exercise.aliases
