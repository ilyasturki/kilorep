<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

import type { Exercise } from '~~/server/database/schema'

const { data: exercises, status } = await useFetch<Exercise[]>('/api/exercises')

const muscleColors: Record<string, string> = {
    chest: 'error',
    triceps: 'warning',
    shoulders: 'secondary',
    back: 'info',
    biceps: 'primary',
    quads: 'success',
    glutes: 'neutral',
    calves: 'warning',
}

const columns: TableColumn<Exercise>[] = [
    {
        accessorKey: 'name',
        header: 'Name',
        meta: { class: { td: 'font-medium capitalize' } },
    },
    {
        accessorKey: 'muscles',
        header: 'Muscles',
        cell: ({ row }) => {
            const muscle = row.getValue<string>('muscles')
            return h(
                resolveComponent('UBadge'),
                {
                    color: muscleColors[muscle] ?? 'neutral',
                    variant: 'subtle',
                    class: 'capitalize',
                },
                () => muscle,
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
                    {{ exercises?.length ?? 0 }} exercises in your catalog
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
