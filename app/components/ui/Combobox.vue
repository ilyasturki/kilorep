<script setup lang="ts" generic="T extends string | number">
import {
    ComboboxAnchor,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxItemIndicator,
    ComboboxPortal,
    ComboboxRoot,
    ComboboxTrigger,
    ComboboxViewport,
    useFilter,
} from 'reka-ui'

type Option = {
    label: string
    value: T
    disabled?: boolean
    // Extra search terms (e.g. exercise aliases) — the one that matched is
    // shown next to the label so the result doesn't look unrelated.
    keywords?: string[]
}

const props = defineProps<{
    items: readonly Option[]
    placeholder?: string
}>()

defineSlots<{
    item?: (props: { option: Option & { matchedAlias?: string } }) => unknown
}>()

const model = defineModel<T>()
const searchTerm = ref('')

// Filter on labels ourselves: the built-in filter only matches against the
// item values, which here are opaque ids.
const { contains } = useFilter({ sensitivity: 'base' })
const filtered = computed<(Option & { matchedAlias?: string })[]>(() =>
    props.items.flatMap((o) => {
        if (contains(o.label, searchTerm.value)) return [o]
        const alias = o.keywords?.find((k) => contains(k, searchTerm.value))
        return alias ? [{ ...o, matchedAlias: alias }] : []
    }),
)

const displayValue = (value: T) =>
    props.items.find((o) => o.value === value)?.label ?? ''

// Pre-select the current label on focus so typing starts a fresh search
// instead of appending to it.
function selectAll(event: FocusEvent) {
    ;(event.target as HTMLInputElement).select()
}
</script>

<template>
    <ComboboxRoot
        v-model="model"
        ignore-filter
        open-on-focus
        open-on-click
    >
        <ComboboxAnchor class="combobox-anchor">
            <ComboboxInput
                v-model="searchTerm"
                class="combobox-input"
                :display-value="displayValue"
                :placeholder="placeholder ?? 'Select…'"
                @focus="selectAll"
            />
            <ComboboxTrigger class="combobox-trigger">
                <Icon
                    name="tabler:chevron-down"
                    :size="16"
                />
            </ComboboxTrigger>
        </ComboboxAnchor>
        <ComboboxPortal>
            <ComboboxContent
                class="combobox-content"
                position="popper"
                :side-offset="6"
            >
                <ComboboxViewport class="select-viewport">
                    <ComboboxEmpty class="combobox-empty">
                        No matching option
                    </ComboboxEmpty>
                    <ComboboxItem
                        v-for="option in filtered"
                        :key="String(option.value)"
                        :value="option.value"
                        :disabled="option.disabled"
                        class="select-item"
                    >
                        <slot
                            name="item"
                            :option="option"
                        >
                            <span>
                                {{ option.label }}
                                <span
                                    v-if="option.matchedAlias"
                                    class="combobox-alias"
                                    >({{ option.matchedAlias }})</span
                                >
                            </span>
                        </slot>
                        <ComboboxItemIndicator>
                            <Icon
                                name="tabler:check"
                                :size="15"
                            />
                        </ComboboxItemIndicator>
                    </ComboboxItem>
                </ComboboxViewport>
            </ComboboxContent>
        </ComboboxPortal>
    </ComboboxRoot>
</template>
