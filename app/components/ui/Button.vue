<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { VariantProps } from 'tailwind-variants'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

const button = tv({
    base: 'inline-flex items-center',
    variants: {
        // Disabled styling is per-tone rather than shared: only primary and
        // ghost ever render disabled, and the two use different opacities.
        tone: {
            primary: [
                'justify-center gap-2 border-none bg-accent px-4.5 py-3',
                'text-body-lg font-extrabold tracking-[-0.01em] text-on-accent',
                '[transition:filter_0.15s,transform_0.08s]',
                'hover:brightness-[1.06] active:scale-[0.99]',
                'disabled:cursor-not-allowed disabled:opacity-45',
            ],
            ghost: [
                'gap-[7px] border border-line-2 bg-transparent px-[15px] py-2.5',
                'text-body font-semibold text-ink',
                'transition-[background] duration-[120ms] hover:bg-surface-2',
                'disabled:cursor-not-allowed disabled:opacity-45',
            ],
            danger: [
                'gap-[7px] border-none bg-red px-4 py-2.5',
                'text-body font-extrabold text-on-red',
                'transition-[filter] duration-150 hover:brightness-[1.08]',
            ],
            link: [
                'gap-1.5 border-none bg-transparent px-0 py-1',
                'text-body-sm font-semibold text-ink-2',
                'transition-[color] duration-[120ms] hover:text-accent-ink',
            ],
        },
        // Declared after `tone` so its padding and size win the merge.
        size: {
            default: '',
            sm: 'px-[11px] py-[7px] text-body-sm',
            lg: 'h-13 w-full text-base',
        },
    },
    defaultVariants: { tone: 'primary', size: 'default' },
})

type ButtonVariants = VariantProps<typeof button>

const props = withDefaults(
    defineProps<
        PrimitiveProps & {
            tone?: ButtonVariants['tone']
            size?: ButtonVariants['size']
            class?: unknown
        }
    >(),
    { as: 'button', tone: 'primary', size: 'default' },
)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="button({ tone, size, class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
