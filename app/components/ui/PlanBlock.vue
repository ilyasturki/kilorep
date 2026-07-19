<script setup lang="ts">
import { tv } from 'tailwind-variants'

// One entry of a session plan or workout readout. A superset trades the divider
// above it for a left rule, so the grouped exercises read as one unit.
const planBlock = tv({
    slots: {
        root: 'border-t border-t-line py-1.5 first:border-t-0',
        tag: 'inline-block pt-1.5 pb-0.5 font-mono text-[9.5px] font-semibold tracking-[0.14em] text-ink-3',
    },
    variants: {
        superset: {
            true: {
                root: 'my-2 border-t-0 border-l-2 border-l-line-2 pl-3.5',
            },
        },
    },
})

const props = defineProps<{ superset?: boolean; class?: unknown }>()

const slots = computed(() => planBlock({ superset: props.superset }))
</script>

<template>
    <div :class="slots.root({ class: props.class as string })">
        <span
            v-if="superset"
            :class="slots.tag()"
            >SUPERSET</span
        >
        <slot />
    </div>
</template>
