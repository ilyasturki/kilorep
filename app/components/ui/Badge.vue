<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { VariantProps } from 'tailwind-variants'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

// Muscle-intensity badge: fill encodes how hard the muscle works.
// solid = prime mover, soft = secondary, outline = assists.
const badge = tv({
    base: [
        'inline-flex items-center whitespace-nowrap',
        'border border-transparent px-[9px] py-[3px]',
        'text-micro font-semibold tracking-[0.01em] capitalize',
    ],
    variants: {
        variant: {
            // The global ::selection is accent-on-ink, identical to this fill,
            // so highlighted text would vanish into it. Invert it here.
            solid: 'border-accent-edge bg-accent text-on-accent selection:bg-on-accent selection:text-accent',
            soft: 'border-accent-line-soft bg-accent-tint text-accent-ink',
            outline: 'border-line-2 bg-transparent text-ink-2',
        },
    },
    defaultVariants: { variant: 'outline' },
})

type BadgeVariants = VariantProps<typeof badge>

const props = withDefaults(
    defineProps<
        PrimitiveProps & {
            variant?: BadgeVariants['variant']
            class?: unknown
        }
    >(),
    { as: 'span', variant: 'outline' },
)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="badge({ variant, class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
