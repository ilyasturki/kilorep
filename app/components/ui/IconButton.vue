<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { VariantProps } from 'tailwind-variants'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

const iconButton = tv({
    base: [
        'inline-flex flex-none items-center justify-center',
        'border border-line bg-transparent text-ink',
        'transition-[border-color] duration-[120ms] hover:border-line-2',
        // After the hover rules so a disabled button (e.g. a move arrow at the
        // list edge) doesn't light up under the cursor.
        'disabled:cursor-default disabled:border-line disabled:opacity-35',
    ],
    variants: {
        tone: {
            default: '',
            danger: 'hover:border-red hover:text-red',
        },
        size: {
            default: 'size-[38px]',
            sm: 'size-8',
        },
    },
    defaultVariants: { tone: 'default', size: 'default' },
})

type IconButtonVariants = VariantProps<typeof iconButton>

const props = withDefaults(
    defineProps<
        PrimitiveProps & {
            tone?: IconButtonVariants['tone']
            size?: IconButtonVariants['size']
            class?: unknown
        }
    >(),
    { as: 'button', tone: 'default', size: 'default' },
)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="iconButton({ tone, size, class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
