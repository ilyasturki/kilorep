<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

const empty = tv({
    base: 'border border-dashed border-line-2 px-5 py-10 text-center text-body text-ink-2',
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
        :class="empty({ class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
