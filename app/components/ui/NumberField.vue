<script setup lang="ts">
import {
    NumberFieldDecrement,
    NumberFieldIncrement,
    NumberFieldInput,
    NumberFieldRoot,
} from 'reka-ui'

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
        <NumberFieldDecrement aria-label="Decrease">
            <Icon
                name="tabler:minus"
                :size="15"
            />
        </NumberFieldDecrement>
        <NumberFieldInput />
        <NumberFieldIncrement aria-label="Increase">
            <Icon
                name="tabler:plus"
                :size="15"
            />
        </NumberFieldIncrement>
    </NumberFieldRoot>
</template>
