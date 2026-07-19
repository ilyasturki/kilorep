<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

const option = tv({
    base: [
        'px-4.5 py-[11px] text-body font-semibold capitalize',
        'transition-[color,background] duration-[120ms]',
        // Hairline divider between adjacent options, not around the group.
        '[&:not(:first-child)]:border-l [&:not(:first-child)]:border-l-line-2',
    ],
    variants: {
        active: {
            true: 'bg-accent text-on-accent',
            false: 'text-ink-3 hover:text-ink',
        },
    },
    defaultVariants: { active: false },
})

const props = withDefaults(
    defineProps<PrimitiveProps & { active?: boolean; class?: unknown }>(),
    { as: 'button', active: false },
)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="option({ active, class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
