<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

// max-md:flex-wrap lets a stretched Segmented drop onto its own line rather
// than pushing the row past a phone-width viewport.
const cardHead = tv({
    base: 'flex flex-wrap items-center justify-between gap-3 md:flex-nowrap',
})

const props = withDefaults(
    defineProps<PrimitiveProps & { class?: unknown }>(),
    { as: 'div' },
)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="cardHead({ class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
