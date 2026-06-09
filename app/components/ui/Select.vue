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
</script>

<template>
    <SelectRoot v-model="model">
        <SelectTrigger class="select-trigger">
            <span :class="{ ph: currentLabel == null }">
                {{ currentLabel ?? placeholder ?? 'Select…' }}
            </span>
            <Icon
                name="tabler:chevron-down"
                :size="16"
            />
        </SelectTrigger>
        <SelectPortal>
            <SelectContent
                class="select-content"
                position="popper"
                :side-offset="6"
            >
                <SelectViewport class="select-viewport">
                    <SelectItem
                        v-for="option in options"
                        :key="String(option.value)"
                        :value="option.value"
                        :disabled="option.disabled"
                        class="select-item"
                    >
                        <SelectItemText>{{ option.label }}</SelectItemText>
                        <SelectItemIndicator>
                            <Icon
                                name="tabler:check"
                                :size="15"
                            />
                        </SelectItemIndicator>
                    </SelectItem>
                </SelectViewport>
            </SelectContent>
        </SelectPortal>
    </SelectRoot>
</template>
