<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

const card = tv({ base: 'border border-line-2 bg-surface p-6' })

const props = withDefaults(
    defineProps<PrimitiveProps & { class?: unknown }>(),
    { as: 'div' },
)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="card({ class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
