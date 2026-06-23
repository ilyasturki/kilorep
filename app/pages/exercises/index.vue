<script setup lang="ts">
import { FetchError } from 'ofetch'

import type {
    Equipment,
    Exercise,
    ExerciseType,
    MuscleIntensity,
} from '~~/server/database/schema'
import {
    EQUIPMENT,
    EXERCISE_TYPES,
    MUSCLE_INTENSITIES,
} from '~~/server/database/schema'

const {
    data: exercises,
    status,
    refresh,
} = await useFetch<Exercise[]>('/api/exercises')

// Fuzzy-rank by the same matcher the combobox uses (name + aliases), so
// searching behaves identically everywhere. Best matches sort to the top; an
// empty query keeps the catalog order.
const search = ref('')

// Muscle groups collapse the 20-muscle vocabulary into the six regions the
// filter offers. Flattening them in order rebuilds the form's muscle list, so
// the two can't drift; each muscle belongs to exactly one group.
const MUSCLE_GROUPS = {
    Chest: ['upper chest', 'chest', 'lower chest'],
    Shoulders: ['front delts', 'side delts', 'rear delts'],
    Back: ['lats', 'rhomboids', 'traps', 'lower back'],
    Arms: ['biceps', 'brachialis', 'forearms', 'triceps'],
    Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
    Core: ['abs', 'obliques'],
} as const
type MuscleGroup = keyof typeof MUSCLE_GROUPS
const MUSCLE_GROUP_NAMES = Object.keys(MUSCLE_GROUPS) as MuscleGroup[]

// The muscle vocabulary the form offers and the table knows how to render.
const muscleOptions = Object.values(MUSCLE_GROUPS).flat()

const muscleToGroup = new Map<string, MuscleGroup>(
    MUSCLE_GROUP_NAMES.flatMap((group) =>
        MUSCLE_GROUPS[group].map((muscle) => [muscle, group] as const),
    ),
)
const groupsOf = (exercise: Exercise) => {
    const groups = new Set<MuscleGroup>()
    for (const m of exercise.muscles) {
        const group = muscleToGroup.get(m.muscle)
        if (group) groups.add(group)
    }
    return groups
}

// Facet filters: an empty list means "no constraint". Within a facet the picks
// are OR'd; the three facets (and the search box) are AND'd together.
const equipmentFilter = ref<Equipment[]>([])
const typeFilter = ref<ExerciseType[]>([])
const muscleFilter = ref<MuscleGroup[]>([])

const hasFilters = computed(
    () =>
        equipmentFilter.value.length > 0
        || typeFilter.value.length > 0
        || muscleFilter.value.length > 0,
)
function clearFilters() {
    equipmentFilter.value = []
    typeFilter.value = []
    muscleFilter.value = []
}

// A column sort overrides the fuzzy ranking when set; null falls back to it
// (best match first, else catalog order). Clicking a header cycles
// asc -> desc -> off, so the default order is always reachable.
type SortKey = 'name' | 'equipment' | 'type'
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
            equipmentFilter.value.length
            && !equipmentFilter.value.includes(exercise.equipment)
        )
            return []
        if (
            typeFilter.value.length
            && !typeFilter.value.includes(exercise.type)
        )
            return []
        if (muscleFilter.value.length) {
            const groups = groupsOf(exercise)
            if (!muscleFilter.value.some((g) => groups.has(g))) return []
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

type MuscleField = { muscle: string; intensity: MuscleIntensity }
const blankMuscle = (): MuscleField => ({ muscle: '', intensity: 'high' })
const blankForm = () => ({
    name: '',
    equipment: 'barbell' as Equipment,
    type: 'compound' as ExerciseType,
    muscles: [blankMuscle()],
})

const toast = useToast()
const isFormOpen = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const form = reactive(blankForm())

const isEditing = computed(() => editingId.value !== null)
const canSubmit = computed(
    () => form.name.trim().length > 0 && form.muscles.some((m) => m.muscle),
)

function openAdd() {
    editingId.value = null
    Object.assign(form, blankForm())
    isFormOpen.value = true
}

function openEdit(exercise: Exercise) {
    editingId.value = exercise.id
    Object.assign(form, {
        name: exercise.name,
        equipment: exercise.equipment,
        type: exercise.type,
        muscles:
            exercise.muscles.length ?
                exercise.muscles.map((m) => ({ ...m }))
            :   [blankMuscle()],
    })
    isFormOpen.value = true
}

function addMuscle() {
    form.muscles.push(blankMuscle())
}

function removeMuscle(index: number) {
    form.muscles.splice(index, 1)
}

async function submit() {
    if (!canSubmit.value) return
    submitting.value = true
    const id = editingId.value
    try {
        await $fetch(id === null ? '/api/exercises' : `/api/exercises/${id}`, {
            method: id === null ? 'POST' : 'PATCH',
            body: {
                name: form.name.trim(),
                equipment: form.equipment,
                type: form.type,
                muscles: form.muscles.filter((m) => m.muscle),
            },
        })
        await refresh()
        isFormOpen.value = false
        toast.add({
            title: id === null ? 'Exercise added' : 'Exercise updated',
            color: 'success',
        })
    } catch (error) {
        toast.add({
            title:
                id === null ?
                    'Could not add exercise'
                :   'Could not update exercise',
            description: errorMessage(error, 'Please try again.'),
            color: 'error',
        })
    } finally {
        submitting.value = false
    }
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
        <div class="mb-5 flex items-center justify-between gap-4">
            <div class="search-box">
                <Icon
                    name="tabler:search"
                    :size="16"
                    class="search-icon"
                />
                <input
                    v-model="search"
                    type="search"
                    class="input"
                    placeholder="Search exercises…"
                    spellcheck="false"
                />
            </div>
            <button
                type="button"
                class="btn-primary"
                @click="openAdd"
            >
                <Icon
                    name="tabler:plus"
                    :size="16"
                />
                Add
            </button>
        </div>

        <div class="facets">
            <UiFilterMenu
                v-model="equipmentFilter"
                label="Equipment"
                :items="[...EQUIPMENT]"
            />
            <UiFilterMenu
                v-model="typeFilter"
                label="Type"
                :items="[...EXERCISE_TYPES]"
            />
            <UiFilterMenu
                v-model="muscleFilter"
                label="Muscles"
                :items="MUSCLE_GROUP_NAMES"
            />
            <button
                v-if="hasFilters"
                type="button"
                class="btn-link facet-clear"
                @click="clearFilters"
            >
                <Icon
                    name="tabler:x"
                    :size="14"
                />
                Clear
            </button>
        </div>

        <div class="xtable">
            <div class="xhead">
                <button
                    type="button"
                    class="xsort"
                    :class="{ on: sort?.key === 'name' }"
                    @click="toggleSort('name')"
                >
                    <span class="kicker">Name</span>
                    <Icon
                        :name="sortIcon('name')"
                        :size="13"
                        class="xsort-icon"
                    />
                </button>
                <button
                    type="button"
                    class="xsort"
                    :class="{ on: sort?.key === 'equipment' }"
                    @click="toggleSort('equipment')"
                >
                    <span class="kicker">Equipment</span>
                    <Icon
                        :name="sortIcon('equipment')"
                        :size="13"
                        class="xsort-icon"
                    />
                </button>
                <button
                    type="button"
                    class="xsort"
                    :class="{ on: sort?.key === 'type' }"
                    @click="toggleSort('type')"
                >
                    <span class="kicker">Type</span>
                    <Icon
                        :name="sortIcon('type')"
                        :size="13"
                        class="xsort-icon"
                    />
                </button>
                <span class="kicker">Muscles</span>
                <span />
            </div>

            <div
                v-if="status === 'pending' && !exercises?.length"
                class="xempty"
            >
                Loading…
            </div>
            <div
                v-else-if="!exercises?.length"
                class="xempty"
            >
                No exercises yet. Add your first movement.
            </div>
            <div
                v-else-if="!filteredExercises.length"
                class="xempty"
            >
                No exercises match your search or filters.
            </div>

            <div
                v-for="{ exercise, match } in filteredExercises"
                :key="exercise.id"
                class="xrow"
            >
                <div class="xname-cell">
                    <div
                        class="xthumb"
                        aria-hidden="true"
                    >
                        <ExerciseIllustration :name="exercise.name" />
                    </div>
                    <span class="xname-text">
                        <NuxtLink
                            :to="`/exercises/${exercise.id}`"
                            class="xname xname--link"
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
                            class="custom-mark"
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
                <div class="xtags">
                    <span class="tag">{{ exercise.equipment }}</span>
                    <span
                        class="tag"
                        :class="{ 'tag--accent': exercise.type === 'compound' }"
                    >
                        {{ exercise.type }}
                    </span>
                </div>
                <div class="xmuscles">
                    <span
                        v-for="m in sortedMuscles(exercise.muscles)"
                        :key="m.muscle"
                        class="badge"
                        :class="`badge--${intensityVariant[m.intensity]}`"
                        :title="`${m.muscle} — ${m.intensity} intensity`"
                    >
                        {{ m.muscle }}
                    </span>
                </div>
                <div class="xcell-actions">
                    <button
                        type="button"
                        class="icon-btn sm"
                        :aria-label="`Edit ${exercise.name}`"
                        @click="openEdit(exercise)"
                    >
                        <Icon
                            name="tabler:pencil"
                            :size="16"
                        />
                    </button>
                    <button
                        type="button"
                        class="icon-btn sm"
                        :aria-label="`Merge ${exercise.name} into another exercise`"
                        @click="openMerge(exercise)"
                    >
                        <Icon
                            name="tabler:arrow-merge"
                            :size="16"
                        />
                    </button>
                    <button
                        type="button"
                        class="icon-btn sm icon-btn--danger"
                        :aria-label="`Delete ${exercise.name}`"
                        @click="exerciseToDelete = exercise"
                    >
                        <Icon
                            name="tabler:trash"
                            :size="16"
                        />
                    </button>
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
            <form
                class="space-y-4"
                @submit.prevent="submit"
            >
                <div class="field">
                    <label class="field-label">
                        Name <span class="req">*</span>
                    </label>
                    <input
                        v-model="form.name"
                        class="input"
                        placeholder="e.g. Barbell Bench Press"
                    />
                </div>

                <div class="flex flex-wrap items-start gap-x-6 gap-y-4">
                    <div class="field w-44">
                        <label class="field-label">Equipment</label>
                        <UiSelect
                            v-model="form.equipment"
                            :items="[...EQUIPMENT]"
                        />
                    </div>
                    <div class="field">
                        <label class="field-label">Type</label>
                        <div class="toggle">
                            <button
                                v-for="t in EXERCISE_TYPES"
                                :key="t"
                                type="button"
                                class="toggle-opt"
                                :class="{ on: form.type === t }"
                                @click="form.type = t"
                            >
                                {{ t }}
                            </button>
                        </div>
                    </div>
                </div>

                <div class="field">
                    <label class="field-label">
                        Muscles <span class="req">*</span>
                    </label>
                    <div class="space-y-2">
                        <div
                            v-for="(m, index) in form.muscles"
                            :key="index"
                            class="flex gap-2"
                        >
                            <div class="min-w-0 flex-1">
                                <UiSelect
                                    v-model="m.muscle"
                                    :items="muscleOptions"
                                    placeholder="Muscle"
                                />
                            </div>
                            <div class="w-32">
                                <UiSelect
                                    v-model="m.intensity"
                                    :items="[...MUSCLE_INTENSITIES]"
                                />
                            </div>
                            <button
                                type="button"
                                class="icon-btn"
                                :disabled="form.muscles.length === 1"
                                aria-label="Remove muscle"
                                @click="removeMuscle(index)"
                            >
                                <Icon
                                    name="tabler:x"
                                    :size="16"
                                />
                            </button>
                        </div>
                        <button
                            type="button"
                            class="btn-link"
                            @click="addMuscle"
                        >
                            <Icon
                                name="tabler:plus"
                                :size="14"
                            />
                            Add muscle
                        </button>
                    </div>
                </div>
            </form>

            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="isFormOpen = false"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="!canSubmit || submitting"
                    @click="submit"
                >
                    <template v-if="isEditing">
                        {{ submitting ? 'Saving…' : 'Save changes' }}
                    </template>
                    <template v-else>
                        {{ submitting ? 'Adding…' : 'Add exercise' }}
                    </template>
                </button>
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
                <button
                    type="button"
                    class="btn-ghost"
                    @click="exerciseToDelete = null"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-danger"
                    :disabled="deleting"
                    @click="deleteExercise"
                >
                    <Icon
                        name="tabler:trash"
                        :size="15"
                    />
                    {{ deleting ? 'Deleting…' : 'Delete' }}
                </button>
            </template>
        </UiModal>

        <!-- Merge exercise -->
        <UiModal
            :open="exerciseToMerge !== null"
            :title="`Merge ${exerciseToMerge?.name}`"
            :description="mergeDescription"
            @update:open="(open) => !open && (exerciseToMerge = null)"
        >
            <div class="field">
                <label class="field-label">Merge into</label>
                <ExerciseCombobox
                    v-model="mergeTargetId"
                    :exercises="mergeCandidates"
                    placeholder="Pick an exercise"
                />
            </div>

            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="exerciseToMerge = null"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-danger"
                    :disabled="mergeTargetId === undefined || merging"
                    @click="mergeExercise"
                >
                    <Icon
                        name="tabler:arrow-merge"
                        :size="15"
                    />
                    {{ merging ? 'Merging…' : 'Merge' }}
                </button>
            </template>
        </UiModal>
    </div>
</template>
