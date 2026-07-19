<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import { tv } from 'tailwind-variants'

const field = tv({ base: 'flex flex-col gap-[7px]' })

const props = withDefaults(
    defineProps<PrimitiveProps & { class?: unknown }>(),
    { as: 'div' },
)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="field({ class: props.class as string })"
    >
        <slot />
    </Primitive>
</template>
