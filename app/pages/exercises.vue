<script setup lang="ts">
import { Pencil, Plus, Trash2, X } from 'lucide-vue-next'

import type {
    Equipment,
    Exercise,
    ExerciseType,
    MuscleIntensity,
    MuscleTarget,
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

// The muscle vocabulary the form offers and the table knows how to render.
const muscleOptions = [
    'upper chest',
    'chest',
    'lower chest',
    'front delts',
    'side delts',
    'rear delts',
    'lats',
    'rhomboids',
    'traps',
    'lower back',
    'biceps',
    'brachialis',
    'forearms',
    'triceps',
    'quads',
    'hamstrings',
    'glutes',
    'calves',
    'abs',
    'obliques',
]

// Intensity is encoded by how filled the badge is: solid = prime mover, soft =
// secondary, down to a thin outline for muscles that only assist.
const intensityVariant: Record<MuscleIntensity, 'solid' | 'soft' | 'outline'> =
    {
        high: 'solid',
        medium: 'soft',
        low: 'outline',
    }
const intensityRank: Record<MuscleIntensity, number> = {
    high: 3,
    medium: 2,
    low: 1,
}

const sortedMuscles = (muscles: MuscleTarget[]) =>
    muscles.toSorted(
        (a, b) => intensityRank[b.intensity] - intensityRank[a.intensity],
    )

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
        toast.add({
            title: 'Could not delete exercise',
            description: errorMessage(error, 'Please try again.'),
            color: 'error',
        })
    } finally {
        deleting.value = false
    }
}
</script>

<template>
    <div>
        <div class="mb-5 flex items-end justify-between gap-4">
            <span class="kicker">Catalog · {{ exercises?.length ?? 0 }}</span>
            <button
                type="button"
                class="btn-primary"
                @click="openAdd"
            >
                <Plus :size="16" /> Add
            </button>
        </div>

        <div class="xtable">
            <div class="xhead">
                <span class="kicker">Name</span>
                <span class="kicker">Equipment</span>
                <span class="kicker">Type</span>
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
                v-for="exercise in exercises"
                :key="exercise.id"
                class="xrow"
            >
                <span class="xname">{{ exercise.name }}</span>
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
                        <Pencil :size="16" />
                    </button>
                    <button
                        type="button"
                        class="icon-btn sm icon-btn--danger"
                        :aria-label="`Delete ${exercise.name}`"
                        @click="exerciseToDelete = exercise"
                    >
                        <Trash2 :size="16" />
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
                                <X :size="16" />
                            </button>
                        </div>
                        <button
                            type="button"
                            class="btn-link"
                            @click="addMuscle"
                        >
                            <Plus :size="14" /> Add muscle
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
                    <Trash2 :size="15" />
                    {{ deleting ? 'Deleting…' : 'Delete' }}
                </button>
            </template>
        </UiModal>
    </div>
</template>
