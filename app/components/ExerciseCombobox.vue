<script setup lang="ts">
import type { Exercise } from '~~/server/database/schema'

const props = defineProps<{
    exercises: readonly Exercise[]
    placeholder?: string
}>()

const model = defineModel<number>()

const byId = computed(() => new Map(props.exercises.map((e) => [e.id, e])))

const items = computed(() =>
    props.exercises.map((e) => ({
        label: e.name,
        value: e.id,
        keywords: exerciseSearchKeywords(e),
    })),
)

const selected = computed(() =>
    model.value === undefined ? undefined : byId.value.get(model.value),
)

const musclesOf = (id: number) => byId.value.get(id)?.muscles ?? []

// Precomputed: the template reads it several times per row on every render.
const topById = computed(
    () =>
        new Map(
            props.exercises.map((e) => [e.id, sortedMuscles(e.muscles)[0]]),
        ),
)
const topOf = (id: number) => topById.value.get(id)
</script>

<template>
    <div class="flex items-center gap-2">
        <MuscleMini
            v-if="selected"
            :muscles="selected.muscles"
        />
        <UiCombobox
            v-model="model"
            :items="items"
            :placeholder="placeholder"
            class="min-w-0 flex-1"
        >
            <template #item="{ option }">
                <MuscleMini :muscles="musclesOf(option.value)" />
                <span class="min-w-0 flex-1 truncate">
                    <UiMatchedLabel
                        :label="option.label"
                        :label-positions="option.labelPositions"
                        :keyword="option.matchedKeyword"
                        :keyword-positions="option.keywordPositions"
                    />
                </span>
                <span
                    v-if="topOf(option.value)"
                    class="badge flex-none"
                    :class="`badge--${intensityVariant[topOf(option.value)!.intensity]}`"
                >
                    {{ topOf(option.value)!.muscle }}
                </span>
            </template>
        </UiCombobox>
    </div>
</template>
