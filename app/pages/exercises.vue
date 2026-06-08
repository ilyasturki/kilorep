<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

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

// Each specific muscle head rolls up to a broad region, which drives its color.
const muscleRegion: Record<string, string> = {
    'upper chest': 'chest',
    chest: 'chest',
    'lower chest': 'chest',
    'front delts': 'shoulders',
    'side delts': 'shoulders',
    'rear delts': 'shoulders',
    lats: 'back',
    rhomboids: 'back',
    traps: 'back',
    'lower back': 'back',
    biceps: 'arms',
    brachialis: 'arms',
    forearms: 'arms',
    triceps: 'arms',
    quads: 'legs',
    hamstrings: 'legs',
    glutes: 'legs',
    calves: 'legs',
    abs: 'core',
    obliques: 'core',
}

const regionColor: Record<string, string> = {
    chest: 'error',
    shoulders: 'secondary',
    back: 'info',
    arms: 'primary',
    legs: 'success',
    core: 'warning',
}

// Intensity is encoded by how filled the badge is: solid = prime mover, down
// to a thin outline for muscles that only assist.
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

// The add form offers the same muscle vocabulary the table knows how to color.
const muscleOptions = Object.keys(muscleRegion)

type MuscleField = { muscle: string; intensity: MuscleIntensity }
const blankMuscle = (): MuscleField => ({ muscle: '', intensity: 'high' })
const blankForm = () => ({
    name: '',
    equipment: 'barbell' as Equipment,
    type: 'compound' as ExerciseType,
    muscles: [blankMuscle()],
})

const toast = useToast()
const isAddOpen = ref(false)
const submitting = ref(false)
const form = reactive(blankForm())

const canSubmit = computed(
    () => form.name.trim().length > 0 && form.muscles.some((m) => m.muscle),
)

function addMuscle() {
    form.muscles.push(blankMuscle())
}

function removeMuscle(index: number) {
    form.muscles.splice(index, 1)
}

async function submit() {
    if (!canSubmit.value) return
    submitting.value = true
    try {
        await $fetch('/api/exercises', {
            method: 'POST',
            body: {
                name: form.name.trim(),
                equipment: form.equipment,
                type: form.type,
                muscles: form.muscles.filter((m) => m.muscle),
            },
        })
        await refresh()
        isAddOpen.value = false
        Object.assign(form, blankForm())
        toast.add({ title: 'Exercise added', color: 'success' })
    } catch (error) {
        toast.add({
            title: 'Could not add exercise',
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

const columns: TableColumn<Exercise>[] = [
    {
        accessorKey: 'name',
        header: 'Name',
        meta: { class: { td: 'font-medium' } },
    },
    {
        accessorKey: 'equipment',
        header: 'Equipment',
        cell: ({ row }) =>
            h(
                resolveComponent('UBadge'),
                {
                    color: 'neutral',
                    variant: 'subtle',
                    class: 'capitalize',
                },
                () => row.getValue<string>('equipment'),
            ),
    },
    {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => {
            const type = row.getValue<string>('type')
            return h(
                resolveComponent('UBadge'),
                {
                    color: type === 'compound' ? 'primary' : 'neutral',
                    variant: 'soft',
                    class: 'capitalize',
                },
                () => type,
            )
        },
    },
    {
        accessorKey: 'muscles',
        header: 'Muscles',
        cell: ({ row }) => {
            const muscles = row
                .getValue<MuscleTarget[]>('muscles')
                .toSorted(
                    (a, b) =>
                        intensityRank[b.intensity] - intensityRank[a.intensity],
                )
            return h(
                'div',
                { class: 'flex flex-wrap gap-1' },
                muscles.map((m) =>
                    h(
                        resolveComponent('UBadge'),
                        {
                            color:
                                regionColor[muscleRegion[m.muscle] ?? '']
                                ?? 'neutral',
                            variant: intensityVariant[m.intensity],
                            class: 'capitalize',
                            title: `${m.muscle} — ${m.intensity} intensity`,
                        },
                        () => m.muscle,
                    ),
                ),
            )
        },
    },
    {
        id: 'actions',
        meta: { class: { td: 'w-0 text-right', th: 'text-right' } },
        cell: ({ row }) =>
            h(resolveComponent('UButton'), {
                icon: 'i-lucide-trash-2',
                color: 'error',
                variant: 'ghost',
                size: 'sm',
                'aria-label': `Delete ${row.original.name}`,
                onClick: () => {
                    exerciseToDelete.value = row.original
                },
            }),
    },
]
</script>

<template>
    <UContainer class="py-8">
        <div class="mb-6 flex items-end justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold">Exercises</h1>
            </div>

            <UModal
                v-model:open="isAddOpen"
                title="Add exercise"
                description="Add a new movement to your catalog."
            >
                <UButton
                    icon="i-lucide-plus"
                    label="Add"
                />

                <template #body>
                    <UForm
                        :state="form"
                        class="space-y-4"
                        @submit.prevent="submit"
                    >
                        <UFormField
                            label="Name"
                            required
                        >
                            <UInput
                                v-model="form.name"
                                placeholder="e.g. Barbell Bench Press"
                                class="w-full"
                                autofocus
                            />
                        </UFormField>

                        <div class="flex gap-4">
                            <UFormField
                                label="Equipment"
                                class="flex-1"
                            >
                                <USelect
                                    v-model="form.equipment"
                                    :items="[...EQUIPMENT]"
                                    class="w-full capitalize"
                                />
                            </UFormField>
                            <UFormField
                                label="Type"
                                class="flex-1"
                            >
                                <USelect
                                    v-model="form.type"
                                    :items="[...EXERCISE_TYPES]"
                                    class="w-full capitalize"
                                />
                            </UFormField>
                        </div>

                        <UFormField
                            label="Muscles"
                            required
                        >
                            <div class="space-y-2">
                                <div
                                    v-for="(m, index) in form.muscles"
                                    :key="index"
                                    class="flex gap-2"
                                >
                                    <USelect
                                        v-model="m.muscle"
                                        :items="muscleOptions"
                                        placeholder="Muscle"
                                        class="flex-1 capitalize"
                                    />
                                    <USelect
                                        v-model="m.intensity"
                                        :items="[...MUSCLE_INTENSITIES]"
                                        class="w-32 capitalize"
                                    />
                                    <UButton
                                        icon="i-lucide-x"
                                        color="neutral"
                                        variant="ghost"
                                        :disabled="form.muscles.length === 1"
                                        @click="removeMuscle(index)"
                                    />
                                </div>
                                <UButton
                                    icon="i-lucide-plus"
                                    label="Add muscle"
                                    color="neutral"
                                    variant="soft"
                                    size="sm"
                                    @click="addMuscle"
                                />
                            </div>
                        </UFormField>
                    </UForm>
                </template>

                <template #footer>
                    <div class="flex w-full justify-end gap-2">
                        <UButton
                            label="Cancel"
                            color="neutral"
                            variant="ghost"
                            @click="isAddOpen = false"
                        />
                        <UButton
                            label="Add exercise"
                            :loading="submitting"
                            :disabled="!canSubmit"
                            @click="submit"
                        />
                    </div>
                </template>
            </UModal>
        </div>

        <UTable
            :data="exercises ?? []"
            :columns="columns"
            :loading="status === 'pending'"
            class="rounded-lg border border-default"
        />

        <UModal
            :open="exerciseToDelete !== null"
            title="Delete exercise"
            :description="`Delete ${exerciseToDelete?.name}? This can't be undone.`"
            @update:open="exerciseToDelete = null"
        >
            <template #footer>
                <div class="flex w-full justify-end gap-2">
                    <UButton
                        label="Cancel"
                        color="neutral"
                        variant="ghost"
                        @click="exerciseToDelete = null"
                    />
                    <UButton
                        label="Delete"
                        color="error"
                        :loading="deleting"
                        @click="deleteExercise"
                    />
                </div>
            </template>
        </UModal>
    </UContainer>
</template>
