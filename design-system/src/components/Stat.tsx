import type { ReactNode } from 'react'
import { tv } from 'tailwind-variants'

// A figure over its caption: the summary blocks on weight, exercise detail and
// workout detail. The dashboard's cards carry a unit and a delta in the same
// stack, so they build their own markup rather than bending this one.
const stat = tv({
    slots: {
        root: 'flex flex-col gap-1',
        // `mono` (tabular figures) on the value only. The caption keeps the
        // family without tnum, matching what the two classes used to do.
        value: 'mono text-[22px] font-semibold tracking-[-0.02em]',
        label: 'font-mono text-[9.5px] tracking-[0.16em] text-ink-3',
    },
})

/** A figure over its caption. The Vue original takes `value`/`label` slots. */
export interface StatProps {
    value?: ReactNode
    label?: ReactNode
    className?: string
}

export function Stat({ value, label, className }: StatProps) {
    const { root, value: valueCls, label: labelCls } = stat()
    return (
        <div className={root({ className })}>
            <span className={valueCls()}>{value}</span>
            <span className={labelCls()}>{label}</span>
        </div>
    )
}
