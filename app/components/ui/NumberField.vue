<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next'
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
}>()

const model = defineModel<number>()
</script>

<template>
    <NumberFieldRoot
        v-model="model"
        :min="min"
        :max="max"
        :step="step ?? 1"
        class="numfield"
    >
        <NumberFieldDecrement aria-label="Decrease">
            <Minus :size="15" />
        </NumberFieldDecrement>
        <NumberFieldInput />
        <NumberFieldIncrement aria-label="Increase">
            <Plus :size="15" />
        </NumberFieldIncrement>
    </NumberFieldRoot>
</template>
