import { Highlight } from './Highlight'

/**
 * A search result's label with its fuzzy-matched characters marked, plus the
 * alternate keyword in parentheses when the hit came from one (e.g. an exercise
 * alias). The keyword half is only rendered when `keyword` is non-empty, and it
 * is dimmed one step (`text-ink-3`) and one size down from the label.
 */
export interface MatchedLabelProps {
    label: string
    labelPositions?: readonly number[]
    keyword?: string
    keywordPositions?: readonly number[]
}

export function MatchedLabel({
    label,
    labelPositions = [],
    keyword = '',
    keywordPositions = [],
}: MatchedLabelProps) {
    return (
        <>
            <Highlight
                text={label}
                positions={labelPositions}
            />
            {keyword ?
                <>
                    {' '}
                    <span className='text-body-sm text-ink-3'>
                        {'('}
                        <Highlight
                            text={keyword}
                            positions={keywordPositions}
                        />
                        {')'}
                    </span>
                </>
            :   null}
        </>
    )
}
