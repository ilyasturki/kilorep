<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

import type {
    Exercise,
    MuscleIntensity,
    MuscleTarget,
} from '~~/server/database/schema'

const { data: exercises, status } = await useFetch<Exercise[]>('/api/exercises')

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
                            size: 'sm',
                            class: 'capitalize',
                            title: `${m.muscle} — ${m.intensity} intensity`,
                        },
                        () => m.muscle,
                    ),
                ),
            )
        },
    },
]
</script>

<template>
    <UContainer class="py-8">
        <div class="mb-6 flex items-end justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold">Exercises</h1>
                <p class="text-muted text-sm">
                    {{ exercises?.length ?? 0 }} exercises in your catalog ·
                    muscle fill shows intensity (solid = primary, outline =
                    assists)
                </p>
            </div>
        </div>

        <UTable
            :data="exercises ?? []"
            :columns="columns"
            :loading="status === 'pending'"
            class="rounded-lg border border-default"
        />
    </UContainer>
</template>
