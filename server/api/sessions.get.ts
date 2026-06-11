import type { SessionWithEntries } from '~~/server/database/schema'
import { loadSessionTrees } from '~~/server/utils/sessions'

export default defineEventHandler((event): SessionWithEntries[] =>
    loadSessionTrees(requireUserId(event)),
)
