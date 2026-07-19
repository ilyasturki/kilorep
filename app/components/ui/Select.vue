<script setup lang="ts" generic="T extends string | number">
import {
    SelectContent,
    SelectItem,
    SelectItemIndicator,
    SelectItemText,
    SelectPortal,
    SelectRoot,
    SelectTrigger,
    SelectViewport,
} from 'reka-ui'
import { tv } from 'tailwind-variants'

const select = tv({
    slots: {
        trigger:
            'inline-flex w-full items-center justify-between gap-2 border border-line-2 bg-surface px-[13px] py-[11px] text-body-lg text-ink capitalize transition-[border-color] duration-[120ms] hover:border-accent',
        value: 'truncate',
        // The reka vars size the panel to its trigger and to the room below it.
        content:
            'z-[60] max-h-[var(--reka-select-content-available-height)] min-w-[var(--reka-select-trigger-width)] overflow-hidden border border-line-2 bg-canvas shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]',
        viewport: 'p-[5px]',
        item: 'flex items-center justify-between gap-2.5 px-[11px] py-[9px] text-body text-ink-2 capitalize outline-none select-none data-highlighted:bg-surface-2 data-highlighted:text-ink data-[state=checked]:text-accent-ink',
    },
    variants: {
        // The placeholder is not a value, so it keeps its own casing.
        placeholder: { true: { value: 'text-ink-3 normal-case' } },
    },
})

type Option = { label: string; value: T; disabled?: boolean }

const props = defineProps<{
    items: readonly (T | Option)[]
    placeholder?: string
}>()

const model = defineModel<T>()

const options = computed<Option[]>(() =>
    props.items.map((item) =>
        typeof item === 'object' ?
            (item as Option)
        :   { label: String(item), value: item as T },
    ),
)

// Render the label ourselves rather than relying on the headless component's
// internal registry, which only resolves once the listbox has been opened.
const currentLabel = computed(
    () => options.value.find((o) => o.value === model.value)?.label,
)

const slots = computed(() =>
    select({ placeholder: currentLabel.value == null }),
)
</script>

<template>
    <SelectRoot v-model="model">
        <SelectTrigger :class="slots.trigger()">
            <span :class="slots.value()">
                {{ currentLabel ?? placeholder ?? 'Select…' }}
            </span>
            <Icon
                name="tabler:chevron-down"
                class="flex-none text-ink-3"
                :size="16"
            />
        </SelectTrigger>
        <SelectPortal>
            <SelectContent
                :class="slots.content()"
                position="popper"
                :side-offset="6"
            >
                <SelectViewport :class="slots.viewport()">
                    <SelectItem
                        v-for="option in options"
                        :key="String(option.value)"
                        :value="option.value"
                        :disabled="option.disabled"
                        :class="slots.item()"
                    >
                        <SelectItemText>{{ option.label }}</SelectItemText>
                        <SelectItemIndicator>
                            <Icon
                                name="tabler:check"
                                class="flex-none text-accent-ink"
                                :size="15"
                            />
                        </SelectItemIndicator>
                    </SelectItem>
                </SelectViewport>
            </SelectContent>
        </SelectPortal>
    </SelectRoot>
</template>
