<script setup lang="ts">
import { FetchError } from 'ofetch'
import {
    PopoverContent,
    PopoverPortal,
    PopoverRoot,
    PopoverTrigger,
} from 'reka-ui'

import type { Exercise } from '~~/server/database/schema'
import type { Equipment, ExerciseType } from '~~/shared/utils/exercise'
import { EQUIPMENT, EXERCISE_TYPES } from '~~/shared/utils/exercise'

const {
    data: exercises,
    status,
    refresh,
} = await useFetch<Exercise[]>(PAYLOAD.exercises, {
    key: PAYLOAD.exercises,
    server: false,
    lazy: true,
    default: () => [],
    getCachedData: cachedPayload,
})
revalidate({ status, refresh })
const loading = initialLoading({ status })
const invalidate = usePayloadCache()

// Fuzzy-rank by the same matcher the combobox uses (name + aliases), so
// searching behaves identically everywhere. Best matches sort to the top; an
// empty query keeps the catalog order.
const search = ref('')

// Facet filters: an empty list means "no constraint". Within a facet the picks
// are OR'd; the three facets (and the search box) are AND'd together. They live
// in one object so the single Filter popover can drive them generically.
const filters = reactive({
    equipment: [] as Equipment[],
    type: [] as ExerciseType[],
    muscles: [] as MuscleGroup[],
})
type FacetKey = keyof typeof filters

// One row per facet drives the Filter popover; the helpers below are
// facet-agnostic so adding a facet is a single entry here.
const FACETS: { key: FacetKey; label: string; items: readonly string[] }[] = [
    { key: 'equipment', label: 'Equipment', items: EQUIPMENT },
    { key: 'type', label: 'Type', items: EXERCISE_TYPES },
    { key: 'muscles', label: 'Muscles', items: MUSCLE_GROUP_NAMES },
]

const activeCount = computed(
    () =>
        filters.equipment.length + filters.type.length + filters.muscles.length,
)
const hasFilters = computed(() => activeCount.value > 0)

const isActive = (key: FacetKey, value: string) =>
    (filters[key] as string[]).includes(value)

function toggleFilter(key: FacetKey, value: string) {
    const picks = filters[key] as string[]
    const at = picks.indexOf(value)
    if (at === -1) picks.push(value)
    else picks.splice(at, 1)
}

function clearFilters() {
    filters.equipment = []
    filters.type = []
    filters.muscles = []
}

// A column sort overrides the fuzzy ranking when set; null falls back to it
// (best match first, else catalog order). Clicking a header cycles
// asc -> desc -> off, so the default order is always reachable.
type SortKey = 'name' | 'equipment' | 'type'
const SORT_COLUMNS: { key: SortKey; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'type', label: 'Type' },
]
const sort = ref<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)
function toggleSort(key: SortKey) {
    if (sort.value?.key !== key) sort.value = { key, dir: 'asc' }
    else if (sort.value.dir === 'asc') sort.value = { key, dir: 'desc' }
    else sort.value = null
}
const sortIcon = (key: SortKey) =>
    sort.value?.key !== key ? 'tabler:arrows-sort'
    : sort.value.dir === 'asc' ? 'tabler:arrow-narrow-up'
    : 'tabler:arrow-narrow-down'

const tokens = computed(() => fuzzyTokens(search.value))
const filteredExercises = computed(() => {
    const hits = (exercises.value ?? []).flatMap((exercise) => {
        if (
            filters.equipment.length
            && !filters.equipment.includes(exercise.equipment)
        )
            return []
        if (filters.type.length && !filters.type.includes(exercise.type))
            return []
        if (filters.muscles.length) {
            const groups = groupsOf(exercise)
            if (!filters.muscles.some((g) => groups.has(g))) return []
        }
        const match = fuzzyMatch(
            exercise.name,
            exerciseSearchKeywords(exercise),
            tokens.value,
        )
        return match ? [{ exercise, match }] : []
    })
    const order = sort.value
    if (order) {
        const dir = order.dir === 'asc' ? 1 : -1
        hits.sort(
            (a, b) =>
                dir
                * a.exercise[order.key].localeCompare(b.exercise[order.key]),
        )
    } else {
        hits.sort((a, b) => b.match.score - a.match.score)
    }
    return hits
})

// Add/edit share one modal: `editing` null means add, otherwise prefill from
// that exercise. The shared ExerciseForm owns the fields, validation, and save;
// we only refetch and close once it reports success.
const toast = useToast()
const isFormOpen = ref(false)
const editing = ref<Exercise | null>(null)
const exerciseForm = useTemplateRef('exerciseForm')

const isEditing = computed(() => editing.value !== null)

function openAdd() {
    editing.value = null
    isFormOpen.value = true
}

function openEdit(exercise: Exercise) {
    editing.value = exercise
    isFormOpen.value = true
}

async function onSaved() {
    await refresh()
    isFormOpen.value = false
}

const exerciseToDelete = ref<Exercise | null>(null)
const deleting = ref(false)

// The delete route marks its in-use 409 with a structured `usage` payload, so
// other conflicts (if the route ever grows one) won't open the merge flow.
const isInUse = (error: unknown) =>
    error instanceof FetchError && error.data?.data?.usage != null

async function deleteExercise() {
    const exercise = exerciseToDelete.value
    if (!exercise) return
    deleting.value = true
    try {
        await $fetch(`/api/exercises/${exercise.id}`, { method: 'DELETE' })
        await refresh()
        exerciseToDelete.value = null
        toast.add({ title: 'Exercise deleted', color: 'success' })
    } catch (error) {
        // In-use exercises can't be deleted — hand over to the merge flow,
        // carrying the server's explanation of where it's used.
        if (isInUse(error)) {
            openMerge(exercise, errorMessage(error, 'This exercise is in use.'))
            exerciseToDelete.value = null
            return
        }
        toast.add({
            title: 'Could not delete exercise',
            description: errorMessage(error, 'Please try again.'),
            color: 'error',
        })
    } finally {
        deleting.value = false
    }
}

const exerciseToMerge = ref<Exercise | null>(null)
const mergeBlockedNote = ref<string | null>(null)
const mergeTargetId = ref<number>()
const merging = ref(false)

const mergeCandidates = computed(() =>
    (exercises.value ?? []).filter((e) => e.id !== exerciseToMerge.value?.id),
)

const mergeDescription = computed(() => {
    const name = exerciseToMerge.value?.name
    const base = `Its template and workout history will move to the exercise you pick, then ${name} is deleted. This can't be undone.`
    return mergeBlockedNote.value ? `${mergeBlockedNote.value}. ${base}` : base
})

function openMerge(exercise: Exercise, blockedNote: string | null = null) {
    exerciseToMerge.value = exercise
    mergeBlockedNote.value = blockedNote
    mergeTargetId.value = undefined
}

async function mergeExercise() {
    const source = exerciseToMerge.value
    const targetId = mergeTargetId.value
    if (!source || targetId === undefined) return
    const target = exercises.value?.find((e) => e.id === targetId)
    merging.value = true
    try {
        await $fetch(`/api/exercises/${source.id}/merge`, {
            method: 'POST',
            body: { targetId },
        })
        // A merge re-points every set that referenced the source exercise, so
        // the workout trees and the dashboard's PRs are both stale now.
        invalidate(PAYLOAD.workouts, PAYLOAD.dashboard)
        await refresh()
        exerciseToMerge.value = null
        toast.add({
            title: `Merged ${source.name} into ${target?.name}`,
            color: 'success',
        })
    } catch (error) {
        toast.add({
            title: 'Could not merge exercise',
            description: errorMessage(error, 'Please try again.'),
            color: 'error',
        })
    } finally {
        merging.value = false
    }
}
</script>

<template>
    <div>
        <!-- Filter, search and Add share one row; search flexes to fill the gap
             and shrinks (min-w-0) so the row never overflows. -->
        <div class="mb-5 flex items-center gap-3">
            <div class="relative min-w-0 max-w-[280px] flex-1">
                <Icon
                    name="tabler:search"
                    :size="16"
                    class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
                />
                <UiInput
                    v-model="search"
                    type="search"
                    class="pl-[38px]"
                    placeholder="Search exercises…"
                    spellcheck="false"
                />
            </div>

            <PopoverRoot>
                <!-- self-stretch takes the search input's height. -->
                <PopoverTrigger
                    class="relative inline-flex flex-none items-center justify-center self-stretch border border-line-2 bg-surface px-3.5 transition-[color,border-color] duration-[120ms] [&>svg]:text-inherit hover:border-accent hover:text-ink data-[state=open]:border-accent data-[state=open]:text-ink"
                    :class="hasFilters ? 'text-ink' : 'text-ink-2'"
                    aria-label="Filter exercises"
                >
                    <Icon
                        name="tabler:filter"
                        :size="17"
                    />
                    <!-- Notification-style badge over the icon's corner; the
                         canvas-colored ring lifts it off the button edge. -->
                    <span
                        v-if="activeCount"
                        class="absolute -top-[7px] -right-[7px] inline-flex h-[17px] min-w-[17px] items-center justify-center border-2 border-canvas bg-accent px-1 text-[10.5px] font-bold text-on-accent"
                    >
                        {{ activeCount }}
                    </span>
                </PopoverTrigger>
                <PopoverPortal>
                    <!-- Every facet as a labelled section of toggle chips. Same
                         surface as the Select panel; the width is fixed (the
                         trigger is narrow) and capped to the viewport so it fits
                         on a phone. -->
                    <PopoverContent
                        class="z-[60] flex w-[280px] max-w-[calc(100vw-32px)] flex-col gap-3.5 overflow-hidden border border-line-2 bg-canvas p-3.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
                        align="end"
                        :side-offset="6"
                    >
                        <div
                            v-for="facet in FACETS"
                            :key="facet.key"
                            class="flex flex-col gap-2"
                        >
                            <span
                                class="text-[10px] font-bold tracking-[0.12em] text-ink-3 uppercase"
                            >
                                {{ facet.label }}
                            </span>
                            <div class="flex flex-wrap gap-[7px]">
                                <button
                                    v-for="item in facet.items"
                                    :key="item"
                                    type="button"
                                    class="border px-3 py-1.5 text-body-sm font-semibold capitalize transition-[color,border-color,background] duration-[120ms]"
                                    :class="
                                        isActive(facet.key, item) ?
                                            'border-accent bg-accent text-on-accent'
                                        :   'border-line-2 bg-surface text-ink-2 hover:border-accent hover:text-ink'
                                    "
                                    @click="toggleFilter(facet.key, item)"
                                >
                                    {{ item }}
                                </button>
                            </div>
                        </div>
                        <UiButton
                            v-if="hasFilters"
                            type="button"
                            tone="link"
                            class="self-start"
                            @click="clearFilters"
                        >
                            <Icon
                                name="tabler:x"
                                :size="14"
                            />
                            Clear all
                        </UiButton>
                    </PopoverContent>
                </PopoverPortal>
            </PopoverRoot>

            <UiButton
                type="button"
                @click="openAdd"
            >
                <Icon
                    name="tabler:plus"
                    :size="16"
                />
                Add
            </UiButton>
        </div>

        <div class="border border-line-2 bg-surface">
            <!-- Column headers only exist once the row becomes a real grid. -->
            <div
                class="hidden lg:grid lg:grid-cols-[minmax(0,1.5fr)_132px_116px_minmax(0,2fr)_78px] lg:items-center lg:gap-[18px] lg:border-b lg:border-b-line-2 lg:px-5 lg:py-[13px]"
            >
                <!-- Sortable headers: bare buttons keeping the kicker label plus a
                     direction arrow that stays dim until the column is active. -->
                <button
                    v-for="col in SORT_COLUMNS"
                    :key="col.key"
                    type="button"
                    class="group/xsort inline-flex items-center gap-[5px] border-none bg-transparent p-0 text-left"
                    @click="toggleSort(col.key)"
                >
                    <span
                        class="kicker"
                        :class="{ 'text-accent-ink': sort?.key === col.key }"
                        >{{ col.label }}</span
                    >
                    <Icon
                        :name="sortIcon(col.key)"
                        :size="13"
                        class="transition-opacity duration-[120ms]"
                        :class="
                            sort?.key === col.key ?
                                'text-accent-ink opacity-100'
                            :   'text-ink-3 opacity-45 group-hover/xsort:opacity-80'
                        "
                    />
                </button>
                <span class="kicker">Muscles</span>
                <span />
            </div>

            <div
                v-if="loading"
                class="px-[18px] py-11 text-center text-body text-ink-2"
            >
                Loading…
            </div>
            <div
                v-else-if="!exercises?.length"
                class="px-[18px] py-11 text-center text-body text-ink-2"
            >
                No exercises yet. Add your first movement.
            </div>
            <div
                v-else-if="!filteredExercises.length"
                class="px-[18px] py-11 text-center text-body text-ink-2"
            >
                No exercises match your search or filters.
            </div>

            <div
                v-for="{ exercise, match } in filteredExercises"
                :key="exercise.id"
                class="relative flex flex-col gap-[11px] border-t border-t-line px-[18px] py-4 first:border-t-0 hover:bg-surface-2 lg:static lg:grid lg:grid-cols-[minmax(0,1.5fr)_132px_116px_minmax(0,2fr)_78px] lg:items-center lg:gap-[18px] lg:px-5 lg:py-3.5"
            >
                <!-- Thumbnail left, name block right; the padding clears the
                     absolutely-positioned actions until the grid takes over. -->
                <div class="flex items-center gap-3 pr-[82px] lg:pr-0">
                    <!-- Reserved square slot: holds the illustration when one
                         exists, stays empty otherwise so names line up. -->
                    <div
                        class="size-14 flex-none overflow-hidden"
                        aria-hidden="true"
                    >
                        <ExerciseIllustration :name="exercise.name" />
                    </div>
                    <!-- Inline flow so the origin icon trails the name's last word
                         and wraps with it. -->
                    <span class="min-w-0 flex-1">
                        <NuxtLink
                            :to="`/exercises/${exercise.id}`"
                            class="text-body-lg font-medium text-ink no-underline capitalize transition-[color] duration-[120ms] hover:text-accent-ink"
                        >
                            <UiMatchedLabel
                                :label="exercise.name"
                                :label-positions="match.labelPositions"
                                :keyword="match.matchedKeyword"
                                :keyword-positions="match.keywordPositions"
                            />
                        </NuxtLink>
                        <span
                            v-if="exercise.source === 'custom'"
                            class="ml-1.5 inline-flex items-center align-middle text-ink-3"
                            role="img"
                            aria-label="Custom exercise"
                            title="Custom exercise"
                        >
                            <Icon
                                name="tabler:user"
                                :size="16"
                            />
                        </span>
                    </span>
                </div>
                <!-- display:contents at lg lets the two tags fall into their own
                     grid columns instead of sharing one cell. -->
                <div class="flex flex-wrap gap-[7px] lg:contents">
                    <UiTag>{{ exercise.equipment }}</UiTag>
                    <UiTag :accent="exercise.type === 'compound'">
                        {{ exercise.type }}
                    </UiTag>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    <UiBadge
                        v-for="m in sortedMuscles(exercise.muscles)"
                        :key="m.muscle"
                        :variant="intensityVariant[m.intensity]"
                        :title="`${m.muscle} — ${m.intensity} intensity`"
                    >
                        {{ m.muscle }}
                    </UiBadge>
                </div>
                <div
                    class="absolute top-[13px] right-3 flex gap-1.5 lg:static lg:justify-self-end"
                >
                    <UiIconButton
                        type="button"
                        size="sm"
                        :aria-label="`Edit ${exercise.name}`"
                        @click="openEdit(exercise)"
                    >
                        <Icon
                            name="tabler:pencil"
                            :size="16"
                        />
                    </UiIconButton>
                    <UiIconButton
                        type="button"
                        size="sm"
                        :aria-label="`Merge ${exercise.name} into another exercise`"
                        @click="openMerge(exercise)"
                    >
                        <Icon
                            name="tabler:arrow-merge"
                            :size="16"
                        />
                    </UiIconButton>
                    <UiIconButton
                        type="button"
                        size="sm"
                        tone="danger"
                        :aria-label="`Delete ${exercise.name}`"
                        @click="exerciseToDelete = exercise"
                    >
                        <Icon
                            name="tabler:trash"
                            :size="16"
                        />
                    </UiIconButton>
                </div>
            </div>
        </div>

        <!-- Add / edit exercise -->
        <UiModal
            v-model:open="isFormOpen"
            :title="isEditing ? 'Edit exercise' : 'Add exercise'"
            :description="
                isEditing ?
                    'Update this movement in your catalog.'
                :   'Add a new movement to your catalog.'
            "
        >
            <ExerciseForm
                ref="exerciseForm"
                :key="editing?.id ?? 'new'"
                :exercise="editing"
                @saved="onSaved"
            />

            <template #footer>
                <UiButton
                    type="button"
                    tone="ghost"
                    @click="isFormOpen = false"
                >
                    Cancel
                </UiButton>
                <UiButton
                    type="button"
                    :disabled="
                        !exerciseForm?.canSubmit || exerciseForm?.submitting
                    "
                    @click="exerciseForm?.submit()"
                >
                    <template v-if="isEditing">
                        {{
                            exerciseForm?.submitting ? 'Saving…' : (
                                'Save changes'
                            )
                        }}
                    </template>
                    <template v-else>
                        {{
                            exerciseForm?.submitting ? 'Adding…' : (
                                'Add exercise'
                            )
                        }}
                    </template>
                </UiButton>
            </template>
        </UiModal>

        <!-- Delete exercise -->
        <UiModal
            :open="exerciseToDelete !== null"
            title="Delete exercise"
            :description="`Delete ${exerciseToDelete?.name}? This can't be undone.`"
            @update:open="(open) => !open && (exerciseToDelete = null)"
        >
            <template #footer>
                <UiButton
                    type="button"
                    tone="ghost"
                    @click="exerciseToDelete = null"
                >
                    Cancel
                </UiButton>
                <UiButton
                    type="button"
                    tone="danger"
                    :disabled="deleting"
                    @click="deleteExercise"
                >
                    <Icon
                        name="tabler:trash"
                        :size="15"
                    />
                    {{ deleting ? 'Deleting…' : 'Delete' }}
                </UiButton>
            </template>
        </UiModal>

        <!-- Merge exercise -->
        <UiModal
            :open="exerciseToMerge !== null"
            :title="`Merge ${exerciseToMerge?.name}`"
            :description="mergeDescription"
            @update:open="(open) => !open && (exerciseToMerge = null)"
        >
            <UiField>
                <UiFieldLabel>Merge into</UiFieldLabel>
                <ExerciseCombobox
                    v-model="mergeTargetId"
                    :exercises="mergeCandidates"
                    placeholder="Pick an exercise"
                />
            </UiField>

            <template #footer>
                <UiButton
                    type="button"
                    tone="ghost"
                    @click="exerciseToMerge = null"
                >
                    Cancel
                </UiButton>
                <UiButton
                    type="button"
                    tone="danger"
                    :disabled="mergeTargetId === undefined || merging"
                    @click="mergeExercise"
                >
                    <Icon
                        name="tabler:arrow-merge"
                        :size="15"
                    />
                    {{ merging ? 'Merging…' : 'Merge' }}
                </UiButton>
            </template>
        </UiModal>
    </div>
</template>
