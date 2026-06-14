<script lang="ts">
import { computed, defineComponent, h } from 'vue'

// Render-function (not a template) on purpose: the matched characters render
// inline with the surrounding text, so a stray whitespace node between segments
// would split a word. h() gives byte-exact output.
export default defineComponent({
    name: 'UiHighlight',
    props: {
        text: { type: String, required: true },
        positions: {
            type: Array as () => readonly number[],
            default: () => [],
        },
    },
    setup(props) {
        const segments = computed(() => {
            const hits = new Set(props.positions)
            const out: { text: string; hit: boolean }[] = []
            let i = 0
            while (i < props.text.length) {
                const hit = hits.has(i)
                let j = i + 1
                while (j < props.text.length && hits.has(j) === hit) j++
                out.push({ text: props.text.slice(i, j), hit })
                i = j
            }
            return out
        })

        return () =>
            h(
                'span',
                segments.value.map((seg, idx) =>
                    seg.hit ?
                        h('mark', { key: idx, class: 'fuzzy-hit' }, seg.text)
                    :   seg.text,
                ),
            )
    },
})
</script>
