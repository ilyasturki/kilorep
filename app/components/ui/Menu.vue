<script setup lang="ts">
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from 'reka-ui'
import { tv } from 'tailwind-variants'

export type MenuItem = {
    label: string
    icon?: string
    tone?: 'default' | 'danger'
    disabled?: boolean
    onSelect: () => void
}

const menu = tv({
    slots: {
        content:
            'z-[60] min-w-[190px] border border-line-2 bg-canvas p-[5px] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]',
        item: 'flex w-full items-center gap-2.5 px-[11px] py-[9px] text-body text-ink-2 outline-none select-none data-disabled:opacity-40 data-highlighted:bg-surface-2 data-highlighted:text-ink',
        icon: 'flex-none text-ink-3',
    },
    variants: {
        tone: {
            default: {},
            danger: {
                item: 'text-red data-highlighted:text-red',
                icon: 'text-red',
            },
        },
    },
    defaultVariants: { tone: 'default' },
})

defineProps<{
    items: MenuItem[]
    // aria-label for the ⋯ trigger ("Exercise actions", "Session actions"…).
    label: string
}>()
</script>

<template>
    <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
            <UiIconButton
                type="button"
                size="sm"
                :aria-label="label"
            >
                <Icon
                    name="tabler:dots"
                    :size="15"
                />
            </UiIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
            <DropdownMenuContent
                :class="menu().content()"
                align="end"
                :side-offset="6"
            >
                <DropdownMenuItem
                    v-for="item in items"
                    :key="item.label"
                    :disabled="item.disabled"
                    :class="menu({ tone: item.tone }).item()"
                    @select="item.onSelect"
                >
                    <Icon
                        v-if="item.icon"
                        :name="item.icon"
                        :size="15"
                        :class="menu({ tone: item.tone }).icon()"
                    />
                    {{ item.label }}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenuPortal>
    </DropdownMenuRoot>
</template>
