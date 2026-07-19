<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

// Plain button row at the foot of a card; the buttons themselves carry flex-1.
const cardActions = tv({ base: 'mt-4.5 flex gap-2.5' })

const props = withDefaults(
    defineProps<PrimitiveProps & { class?: unknown }>(),
    { as: 'div' },
)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="cardActions({ class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
