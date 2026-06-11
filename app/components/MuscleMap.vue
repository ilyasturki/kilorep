<script setup lang="ts">
import type { MuscleTarget } from '~~/server/database/schema'

defineProps<{ muscles: MuscleTarget[] }>()
</script>

<template>
    <div class="musclemap">
        <div class="mm-view">
            <svg
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

        <div class="mm-view">
            <svg
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
