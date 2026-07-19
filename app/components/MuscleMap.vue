<script setup lang="ts">
import type { MuscleTarget } from '~~/server/database/schema'

defineProps<{ muscles: MuscleTarget[] }>()
</script>

<template>
    <div class="flex flex-wrap items-start gap-x-7 gap-y-2">
        <div class="flex flex-col items-center gap-[9px]">
            <svg
                class="h-auto w-[130px]"
                :viewBox="MUSCLE_MAP_VIEWBOX"
                role="img"
                aria-label="Muscles worked, front view"
            >
                <MuscleShapes
                    :shapes="frontShapes"
                    :muscles="muscles"
                />
            </svg>
            <span class="kicker">Front</span>
        </div>

        <div class="flex flex-col items-center gap-[9px]">
            <svg
                class="h-auto w-[130px]"
                :viewBox="MUSCLE_MAP_VIEWBOX"
                role="img"
                aria-label="Muscles worked, back view"
            >
                <MuscleShapes
                    :shapes="backShapes"
                    :muscles="muscles"
                />
            </svg>
            <span class="kicker">Back</span>
        </div>
    </div>
</template>
