<script lang="ts">
import { defineComponent, h } from 'vue'

import UiHighlight from './Highlight.vue'

// A search result's label with its fuzzy-matched characters marked, plus the
// alternate keyword in parentheses when the hit came from one (e.g. an exercise
// alias). Render-function for the same reason as UiHighlight: the parens sit
// inline against the keyword, so a stray whitespace node would split them off.
export default defineComponent({
    name: 'UiMatchedLabel',
    props: {
        label: { type: String, required: true },
        labelPositions: {
            type: Array as () => readonly number[],
            default: () => [],
        },
        keyword: { type: String, default: '' },
        keywordPositions: {
            type: Array as () => readonly number[],
            default: () => [],
        },
    },
    setup(props) {
        return () => [
            h(UiHighlight, {
                text: props.label,
                positions: props.labelPositions,
            }),
            ...(props.keyword ?
                [
                    ' ',
                    h('span', { class: 'search-alias' }, [
                        '(',
                        h(UiHighlight, {
                            text: props.keyword,
                            positions: props.keywordPositions,
                        }),
                        ')',
                    ]),
                ]
            :   []),
        ]
    },
})
</script>
