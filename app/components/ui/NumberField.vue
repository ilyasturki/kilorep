<script setup lang="ts">
import { NumberFieldInput, NumberFieldRoot } from 'reka-ui'
import { tv } from 'tailwind-variants'

const numberField = tv({
    slots: {
        root: 'inline-flex w-[120px] items-center border border-line-2 bg-surface',
        // Native spinners removed on both engines: the +/- steppers replace them.
        input: 'w-full min-w-0 border-0 bg-transparent px-1 py-2.25 text-center font-mono text-body-lg text-ink outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none',
    },
})

// `class` is a declared prop so it reaches tv()'s twMerge: call sites that size
// the field (w-full in a grid cell) must beat the default w-[120px], and both
// are utilities now that the components layer is gone.
const props = defineProps<{
    min?: number
    max?: number
    step?: number
    stepSnapping?: boolean
    class?: unknown
}>()

const model = defineModel<number>()
const { root, input } = numberField()
</script>

<template>
    <NumberFieldRoot
        v-model="model"
        :min="min"
        :max="max"
        :step="step ?? 1"
        :step-snapping="stepSnapping ?? true"
        :class="root({ class: props.class as string })"
    >
        <UiNumberStep dir="dec" />
        <NumberFieldInput :class="input()" />
        <UiNumberStep dir="inc" />
    </NumberFieldRoot>
</template>
