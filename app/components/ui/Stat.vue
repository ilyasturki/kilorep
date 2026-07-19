<script setup lang="ts">
import { tv } from 'tailwind-variants'

// A figure over its caption: the summary blocks on weight, exercise detail and
// workout detail. The dashboard's cards carry a unit and a delta in the same
// stack, so they build their own markup rather than bending this one.
const stat = tv({
    slots: {
        root: 'flex flex-col gap-1',
        // `mono` (tabular figures) on the value only. The caption keeps the
        // family without tnum, matching what the two classes used to do.
        value: 'mono text-[22px] font-semibold tracking-[-0.02em]',
        label: 'font-mono text-[9.5px] tracking-[0.16em] text-ink-3',
    },
})

const props = defineProps<{ class?: unknown }>()

const { root, value, label } = stat()
</script>

<template>
    <div :class="root({ class: props.class as string })">
        <span :class="value()"><slot name="value" /></span>
        <span :class="label()"><slot name="label" /></span>
    </div>
</template>
