<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

const fieldLabel = tv({
    base: 'font-mono text-[10.5px] font-semibold tracking-[0.16em] uppercase text-ink-3',
})

const props = withDefaults(
    defineProps<PrimitiveProps & { class?: unknown }>(),
    { as: 'label' },
)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="fieldLabel({ class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
