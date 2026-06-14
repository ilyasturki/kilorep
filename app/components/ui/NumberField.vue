<script setup lang="ts">
import { NumberFieldInput, NumberFieldRoot } from 'reka-ui'

defineProps<{
    min?: number
    max?: number
    step?: number
    stepSnapping?: boolean
}>()

const model = defineModel<number>()
</script>

<template>
    <NumberFieldRoot
        v-model="model"
        :min="min"
        :max="max"
        :step="step ?? 1"
        :step-snapping="stepSnapping ?? true"
        class="numfield"
    >
        <UiNumberStep dir="dec" />
        <NumberFieldInput />
        <UiNumberStep dir="inc" />
    </NumberFieldRoot>
</template>
