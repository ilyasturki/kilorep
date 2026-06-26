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
} from 'reka-ui'

import type { FuzzyMatch } from '~/utils/fuzzy'

type Option = {
    label: string
    value: T
    disabled?: boolean
    // Extra search terms (e.g. exercise aliases) — the one that matched is
    // shown next to the label so the result doesn't look unrelated.
    keywords?: string[]
}

type Matched = Option & FuzzyMatch

const props = defineProps<{
    items: readonly Option[]
    placeholder?: string
}>()

defineSlots<{
    item?: (props: { option: Matched }) => unknown
    // Shown when nothing matches; receives the live query so callers can offer
    // to create it. `footer` stays pinned at the bottom whether or not there
    // are matches.
    empty?: (props: { query: string }) => unknown
    footer?: (props: { query: string }) => unknown
}>()

const model = defineModel<T>()
const searchTerm = ref('')

// Fuzzy-match labels and keywords ourselves (reka-ui's filter only matches the
// opaque item values) and rank by score so the best hit lands on top — Enter
// then selects it. An empty query scores every item 0, so the stable sort keeps
// the original order.
const tokens = computed(() => fuzzyTokens(searchTerm.value))
const filtered = computed<Matched[]>(() =>
    props.items
        .flatMap((o) => {
            const match = fuzzyMatch(o.label, o.keywords ?? [], tokens.value)
            return match ? [{ ...o, ...match }] : []
        })
        .sort((a, b) => b.score - a.score),
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
                        <slot
                            name="empty"
                            :query="searchTerm"
                        >
                            <span class="combobox-empty-text">
                                No matching option
                            </span>
                        </slot>
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
                            <UiMatchedLabel
                                :label="option.label"
                                :label-positions="option.labelPositions"
                                :keyword="option.matchedKeyword"
                                :keyword-positions="option.keywordPositions"
                            />
                        </slot>
                        <ComboboxItemIndicator>
                            <Icon
                                name="tabler:check"
                                :size="15"
                            />
                        </ComboboxItemIndicator>
                    </ComboboxItem>
                </ComboboxViewport>
                <div
                    v-if="$slots.footer"
                    class="combobox-footer"
                >
                    <slot
                        name="footer"
                        :query="searchTerm"
                    />
                </div>
            </ComboboxContent>
        </ComboboxPortal>
    </ComboboxRoot>
</template>
