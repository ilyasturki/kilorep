<script setup lang="ts">
import type { MuscleTarget } from '~~/server/database/schema'
import type { MuscleMapShape } from '~/utils/muscleMap'

const props = defineProps<{
    shapes: readonly MuscleMapShape[]
    muscles: MuscleTarget[]
}>()

const byMuscle = computed(() => muscleIntensities(props.muscles))
const cls = (names: string[]) => mapRegionClass(names, byMuscle.value)
</script>

<!-- Renders inside an <svg> owned by the caller, so each view keeps its own
     accessible name while the shape markup lives in one place. -->
<template>
    <template
        v-for="(s, i) in shapes"
        :key="i"
    >
        <rect
            v-if="s.el === 'rect'"
            :x="s.x"
            :y="s.y"
            :width="s.w"
            :height="s.h"
            :rx="s.rx"
            :class="cls(s.m)"
        />
        <ellipse
            v-else-if="s.el === 'ellipse'"
            :cx="s.cx"
            :cy="s.cy"
            :rx="s.rx"
            :ry="s.ry"
            :class="cls(s.m)"
        />
        <path
            v-else
            :d="s.d"
            :class="cls(s.m)"
        />
    </template>
</template>
