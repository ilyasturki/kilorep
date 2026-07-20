import { Segmented, SegmentedOption } from '@kilorep/lift-react'

export function SessionViews() {
    return (
        <Segmented>
            <SegmentedOption active>Detailed</SegmentedOption>
            <SegmentedOption>Condensed</SegmentedOption>
        </Segmented>
    )
}

export function ExerciseType() {
    return (
        <Segmented>
            <SegmentedOption active>compound</SegmentedOption>
            <SegmentedOption>isolation</SegmentedOption>
        </Segmented>
    )
}

export function RangePicker() {
    return (
        <Segmented>
            <SegmentedOption>1W</SegmentedOption>
            <SegmentedOption>1M</SegmentedOption>
            <SegmentedOption active>3M</SegmentedOption>
            <SegmentedOption>1Y</SegmentedOption>
            <SegmentedOption>All</SegmentedOption>
        </Segmented>
    )
}
