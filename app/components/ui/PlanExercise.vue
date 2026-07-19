<script setup lang="ts">
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

// A numbered exercise line inside a PlanBlock: index, name, target summary.
// Given `to` it becomes a link to that exercise's history, tinting the name on
// hover rather than carrying link chrome into the dense list.
const planExercise = tv({
    slots: {
        root: 'grid grid-cols-[28px_1fr_auto] items-center gap-3 py-[11px]',
        index: 'font-mono text-label text-ink-3',
        name: 'text-body-lg font-medium capitalize',
        target: 'font-mono text-label text-ink-2',
    },
    variants: {
        link: {
            true: {
                root: 'text-inherit no-underline',
                name: 'group-hover/plan-ex:text-accent-ink',
            },
        },
    },
})

const props = defineProps<{
    index: string | number
    name: string
    target?: string
    to?: string
    class?: unknown
}>()

const slots = computed(() => planExercise({ link: props.to != null }))
</script>

<template>
    <Primitive
        :as="to ? 'router-link' : 'div'"
        :to="to"
        :class="[
            slots.root({ class: props.class as string }),
            to && 'group/plan-ex',
        ]"
    >
        <span :class="slots.index()">{{ index }}</span>
        <span :class="slots.name()">{{ name }}</span>
        <span :class="slots.target()">{{ target }}</span>
    </Primitive>
</template>
