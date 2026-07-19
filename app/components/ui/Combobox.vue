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
import { tv } from 'tailwind-variants'

import type { FuzzyMatch } from '~/utils/fuzzy'

const combobox = tv({
    slots: {
        anchor: 'inline-flex w-full items-center gap-2 border border-line-2 bg-surface px-[13px] py-[11px] transition-[border-color] duration-[120ms] hover:border-accent focus-within:border-accent',
        input: 'min-w-0 flex-1 border-0 bg-transparent text-body-lg text-ink capitalize outline-none placeholder:text-ink-3 placeholder:normal-case',
        trigger: 'flex border-0 bg-transparent p-0 text-ink-3',
        // Capped to the viewport: rich rows (silhouette + alias + badge) can be
        // wider than the trigger and would otherwise clip off-screen on mobile.
        content:
            'z-[60] max-h-[var(--reka-combobox-content-available-height)] max-w-[var(--reka-combobox-content-available-width)] min-w-[var(--reka-combobox-trigger-width)] overflow-x-hidden overflow-y-auto border border-line-2 bg-canvas shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]',
        viewport: 'p-[5px]',
        // Padding lives on the inner text/actions so a full-width create row
        // isn't double-inset.
        empty: 'p-0',
        // Mirrors UiSelect's listbox row.
        item: 'flex items-center justify-between gap-2.5 px-[11px] py-[9px] text-body text-ink-2 capitalize outline-none select-none data-highlighted:bg-surface-2 data-highlighted:text-ink data-[state=checked]:text-accent-ink',
        footer: 'sticky bottom-0 border-t border-t-line-2 bg-canvas p-[5px]',
    },
})

const ui = combobox()

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
        <ComboboxAnchor :class="ui.anchor()">
            <ComboboxInput
                v-model="searchTerm"
                :class="ui.input()"
                :display-value="displayValue"
                :placeholder="placeholder ?? 'Select…'"
                @focus="selectAll"
            />
            <ComboboxTrigger :class="ui.trigger()">
                <Icon
                    name="tabler:chevron-down"
                    :size="16"
                />
            </ComboboxTrigger>
        </ComboboxAnchor>
        <ComboboxPortal>
            <ComboboxContent
                :class="ui.content()"
                position="popper"
                :side-offset="6"
            >
                <ComboboxViewport :class="ui.viewport()">
                    <ComboboxEmpty :class="ui.empty()">
                        <slot
                            name="empty"
                            :query="searchTerm"
                        >
                            <span
                                class="block px-[11px] py-[9px] text-body text-ink-3"
                            >
                                No matching option
                            </span>
                        </slot>
                    </ComboboxEmpty>
                    <ComboboxItem
                        v-for="option in filtered"
                        :key="String(option.value)"
                        :value="option.value"
                        :disabled="option.disabled"
                        :class="ui.item()"
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
                    :class="ui.footer()"
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
