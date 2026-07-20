import { Segmented, SegmentedOption } from '@kilorep/lift-react'

// SegmentedOption carries no state and is never used alone: the parent owns
// selection, so every cell shows the option inside its Segmented.

export function ActiveAndIdle() {
    return (
        <Segmented>
            <SegmentedOption active>compound</SegmentedOption>
            <SegmentedOption>isolation</SegmentedOption>
        </Segmented>
    )
}

export function MiddleActive() {
    return (
        <Segmented>
            <SegmentedOption>detailed</SegmentedOption>
            <SegmentedOption active>condensed</SegmentedOption>
            <SegmentedOption>calendar</SegmentedOption>
        </Segmented>
    )
}

export function NoneActive() {
    return (
        <Segmented>
            <SegmentedOption>1W</SegmentedOption>
            <SegmentedOption>1M</SegmentedOption>
            <SegmentedOption>3M</SegmentedOption>
            <SegmentedOption>1Y</SegmentedOption>
            <SegmentedOption>All</SegmentedOption>
        </Segmented>
    )
}
