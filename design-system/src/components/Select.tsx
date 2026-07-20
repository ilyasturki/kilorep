import { tv } from 'tailwind-variants'
import * as RadixSelect from '@radix-ui/react-select'

import { IconCheck, IconChevronDown } from '../lib/icons'

const select = tv({
    slots: {
        trigger:
            'inline-flex w-full items-center justify-between gap-2 border border-line-2 bg-surface px-[13px] py-[11px] text-body-lg text-ink capitalize transition-[border-color] duration-[120ms] hover:border-accent',
        value: 'truncate',
        // Sizes the panel to its trigger and to the room below it. The Vue
        // original reads the same values off reka's `--reka-*` vars; Radix
        // publishes them under `--radix-*`, so the names differ by necessity.
        content:
            'z-[60] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden border border-line-2 bg-canvas shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]',
        viewport: 'p-[5px]',
        item: 'flex items-center justify-between gap-2.5 px-[11px] py-[9px] text-body text-ink-2 capitalize outline-none select-none data-highlighted:bg-surface-2 data-highlighted:text-ink data-[state=checked]:text-accent-ink',
    },
    variants: {
        // The placeholder is not a value, so it keeps its own casing.
        placeholder: { true: { value: 'text-ink-3 normal-case' } },
        // Only labels we derived from a bare value get title-cased. An explicit
        // `label` is human-authored and must survive verbatim, or
        // 'English (UK)' renders as 'English (Uk)'.
        authored: { true: { value: 'normal-case', item: 'normal-case' } },
    },
})

export type SelectOption = { label: string; value: string; disabled?: boolean }

/**
 * Single-choice dropdown. `items` accepts bare strings or `{label, value}`
 * objects; values are capitalised by the trigger, the placeholder is not.
 */
export interface SelectProps {
    items: readonly (string | SelectOption)[]
    value?: string
    onValueChange?: (value: string) => void
    placeholder?: string
}

export function Select({
    items,
    value,
    onValueChange,
    placeholder,
}: SelectProps) {
    const options = items.map((item) =>
        typeof item === 'object' ?
            { ...item, authored: true }
        :   {
                label: item,
                value: item,
                disabled: undefined,
                authored: false,
            },
    )

    // Render the label ourselves rather than relying on the headless component's
    // internal registry, which only resolves once the listbox has been opened.
    const current = options.find((o) => o.value === value)
    const currentLabel = current?.label

    const slots = select({
        placeholder: currentLabel == null,
        authored: current?.authored ?? false,
    })

    return (
        <RadixSelect.Root
            value={value}
            onValueChange={onValueChange}
        >
            <RadixSelect.Trigger className={slots.trigger()}>
                <span className={slots.value()}>
                    {currentLabel ?? placeholder ?? 'Select…'}
                </span>
                <IconChevronDown
                    size={16}
                    className='flex-none text-ink-3'
                />
            </RadixSelect.Trigger>
            <RadixSelect.Portal>
                <RadixSelect.Content
                    className={slots.content()}
                    position='popper'
                    sideOffset={6}
                >
                    <RadixSelect.Viewport className={slots.viewport()}>
                        {options.map((option) => (
                            <RadixSelect.Item
                                key={option.value}
                                value={option.value}
                                disabled={option.disabled}
                                // Casing is per-row: a list can mix derived and
                                // authored labels.
                                className={select({
                                    authored: option.authored,
                                }).item()}
                            >
                                <RadixSelect.ItemText>
                                    {option.label}
                                </RadixSelect.ItemText>
                                <RadixSelect.ItemIndicator>
                                    <IconCheck
                                        size={15}
                                        className='flex-none text-accent-ink'
                                    />
                                </RadixSelect.ItemIndicator>
                            </RadixSelect.Item>
                        ))}
                    </RadixSelect.Viewport>
                </RadixSelect.Content>
            </RadixSelect.Portal>
        </RadixSelect.Root>
    )
}
