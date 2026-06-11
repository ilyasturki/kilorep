<script setup lang="ts">
import type { MuscleTarget } from '~~/server/database/schema'

const props = defineProps<{ muscles: MuscleTarget[] }>()

const top = computed(() => sortedMuscles(props.muscles)[0]?.muscle)

// One view only — whichever side of the body shows the top muscle.
const shapes = computed(() =>
    top.value && !frontMuscleNames.has(top.value) ? backShapes : frontShapes,
)
</script>

<template>
    <svg
        class="mm-mini"
        :viewBox="MUSCLE_MAP_VIEWBOX"
        role="img"
        :aria-label="top ? `Targets ${top}` : undefined"
        :aria-hidden="top ? undefined : 'true'"
    >
        <MuscleShapes
            :shapes="shapes"
            :muscles="muscles"
        />
    </svg>
</template>
