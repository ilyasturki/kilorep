<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

const segmented = tv({
    base: 'inline-flex border border-line-2 bg-surface',
    variants: {
        // A multi-option toggle next to an action button is wider than a
        // phone-width row, which drags the layout viewport past the screen (and
        // unseats the fixed tabbar). Stretch it across its own line instead, so
        // the options shrink to fit. The wrapping row needs max-md:flex-wrap.
        stretch: {
            true: 'max-md:flex max-md:[flex:1_1_100%] max-md:[&>*]:flex-1 max-md:[&>*]:px-0 max-md:[&>*]:text-center',
            false: '',
        },
    },
    defaultVariants: { stretch: false },
})

const props = withDefaults(
    defineProps<PrimitiveProps & { stretch?: boolean; class?: unknown }>(),
    { as: 'div', stretch: false },
)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="segmented({ stretch, class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
