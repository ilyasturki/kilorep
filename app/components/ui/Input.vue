<script setup lang="ts">
import type { VariantProps } from 'tailwind-variants'
import { tv } from 'tailwind-variants'

const input = tv({
    base: [
        'w-full border border-line-2 bg-surface px-[13px] py-[11px]',
        'font-[inherit] text-ink outline-none placeholder:text-ink-3',
        'transition-[border-color] duration-[120ms] focus:border-accent',
        // Explicit `text-ink`/`bg-surface` above override the UA's own disabled
        // greying, so without this a disabled input is indistinguishable from an
        // editable one. Matches Button's disabled treatment.
        'disabled:cursor-not-allowed disabled:opacity-45',
    ],
    variants: {
        size: {
            default: 'text-body-lg',
            sm: 'px-2.5 py-[7px] text-body',
        },
    },
    defaultVariants: { size: 'default' },
})

type InputVariants = VariantProps<typeof input>

const props = withDefaults(
    defineProps<{ size?: InputVariants['size']; class?: unknown }>(),
    { size: 'default' },
)

const model = defineModel<string | number>()

// Callers drive the caret directly (autofocus-and-select on open, inline
// rename), which a component ref can't reach without this.
const el = ref<HTMLInputElement | null>(null)
defineExpose({
    focus: (options?: FocusOptions) => el.value?.focus(options),
    select: () => el.value?.select(),
})
</script>

<template>
    <input
        ref="el"
        v-model="model"
        :class="input({ size, class: props.class as string })"
    />
</template>
