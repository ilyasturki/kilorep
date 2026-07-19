<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { VariantProps } from 'tailwind-variants'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

const tag = tv({
    base: [
        'inline-flex items-center gap-[5px] whitespace-nowrap',
        'border border-line bg-surface-2 px-2 py-1',
        'font-mono text-[10.5px] font-semibold tracking-[0.08em] uppercase text-ink-2',
    ],
    variants: {
        accent: {
            true: 'border-accent-line text-accent-ink',
            false: '',
        },
        // Sits beside a 32px delete icon button in the workout card header;
        // matching its height keeps the row from floating short.
        size: {
            default: '',
            lg: 'h-8 py-0',
        },
    },
    defaultVariants: { accent: false, size: 'default' },
})

type TagVariants = VariantProps<typeof tag>

const props = withDefaults(
    defineProps<
        PrimitiveProps & {
            accent?: boolean
            size?: TagVariants['size']
            class?: unknown
        }
    >(),
    { as: 'span', accent: false, size: 'default' },
)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="tag({ accent, size, class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
