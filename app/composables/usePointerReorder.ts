import type { StyleValue } from 'vue'

// Pointer-driven drag-to-reorder for a uniform vertical list (the condensed
// sessions rows). Hand-rolled rather than pulling in a DnD library: it's one
// list, so there's nothing to own but this file. The lifted row follows the
// pointer while its siblings slide aside to open the drop slot; nothing is
// written to the data array until the drop, so a pointercancel or Escape just
// abandons the gesture with no state to undo. The up/down arrows remain the
// keyboard and screen-reader path, so the handle stays presentational.
interface ReorderOptions {
    // Current list length, read live (the list can change between drags).
    count: () => number
    // Fired on drop with a real move (to !== from); the caller mutates + persists.
    onCommit: (from: number, to: number) => void
    // Block starting a drag, e.g. while a previous reorder is still saving.
    disabled?: () => boolean
}

// Pixels the pointer must travel before a press becomes a drag, so a plain tap
// on the handle isn't read as a zero-distance reorder.
const DRAG_THRESHOLD = 5

export function usePointerReorder(options: ReorderOptions) {
    const dragIndex = ref<number | null>(null)
    const overIndex = ref<number | null>(null)
    const offset = ref(0)
    const noTransition = ref(false)

    let armed = false
    let fromIndex = 0
    let startY = 0
    let step = 0
    let pointerId = -1
    let handleEl: HTMLElement | null = null

    const isDragging = computed(() => dragIndex.value !== null)

    function onHandlePointerDown(event: PointerEvent, index: number) {
        if (options.disabled?.()) return
        if (!event.isPrimary || event.button > 0) return
        if (dragIndex.value !== null || armed) return

        const handle = event.currentTarget
        if (!(handle instanceof HTMLElement)) return
        const row = handle.closest<HTMLElement>('[data-reorder-row]')
        const container = row?.parentElement
        if (!row || !container) return

        const rows = Array.from(container.children).filter(
            (child): child is HTMLElement => child instanceof HTMLElement,
        )
        if (rows.length < 2) return
        // Uniform rows: the top-to-top pitch is exactly one slot's worth of
        // travel, which lets a move map to a slot count without hit-testing
        // siblings that are themselves being transformed.
        step =
            Math.abs(
                rows[1]!.getBoundingClientRect().top
                    - rows[0]!.getBoundingClientRect().top,
            ) || row.offsetHeight
        if (!step) return

        armed = true
        fromIndex = index
        startY = event.clientY
        pointerId = event.pointerId
        handleEl = handle
        try {
            handle.setPointerCapture(event.pointerId)
        } catch {
            // capture is best-effort; the window listeners carry the gesture
        }
        window.addEventListener('pointermove', onPointerMove, {
            passive: false,
        })
        window.addEventListener('pointerup', onPointerUp)
        window.addEventListener('pointercancel', onPointerCancel)
        window.addEventListener('keydown', onKeyDown)
        event.preventDefault()
        event.stopPropagation()
    }

    function onPointerMove(event: PointerEvent) {
        if (event.pointerId !== pointerId) return
        const dy = event.clientY - startY
        if (armed) {
            if (Math.abs(dy) <= DRAG_THRESHOLD) return
            dragIndex.value = fromIndex
            overIndex.value = fromIndex
            armed = false
            // Hold a grabbing cursor (and kill text selection) page-wide for the
            // gesture; the handle's own cursor: grab would otherwise win under
            // the pointer. Cleared in teardown on any exit path.
            document.body.classList.add('reorder-grabbing')
        }
        offset.value = dy
        const last = options.count() - 1
        const target = fromIndex + Math.round(dy / step)
        overIndex.value = Math.min(Math.max(target, 0), last)
        event.preventDefault()
    }

    function onPointerUp(event: PointerEvent) {
        if (event.pointerId !== pointerId) return
        end(true)
    }
    function onPointerCancel(event: PointerEvent) {
        if (event.pointerId !== pointerId) return
        end(false)
    }
    function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') end(false)
    }

    function end(commit: boolean) {
        const from = dragIndex.value
        const to = overIndex.value
        teardown()

        dragIndex.value = null
        overIndex.value = null
        offset.value = 0

        if (commit && from !== null && to !== null && to !== from) {
            // Freeze transitions for the one frame where live transforms drop
            // and the real array order takes over, so the rows (already where
            // they belong on screen) don't animate the swap or trip FLIP.
            noTransition.value = true
            options.onCommit(from, to)
            void nextTick(() => {
                requestAnimationFrame(() => {
                    noTransition.value = false
                })
            })
        }
    }

    function teardown() {
        armed = false
        document.body.classList.remove('reorder-grabbing')
        if (handleEl && pointerId !== -1) {
            try {
                handleEl.releasePointerCapture(pointerId)
            } catch {
                // capture may already be lost; nothing to release
            }
        }
        handleEl = null
        pointerId = -1
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)
        window.removeEventListener('keydown', onKeyDown)
    }

    onScopeDispose(teardown)

    // Inline transform for row `index` during a drag: the lifted row tracks the
    // pointer (its own transition off so it doesn't lag the finger); each
    // sibling between the grabbed and target slots shifts by one pitch to open
    // the gap. Returns undefined when idle so the row keeps its normal styles.
    function rowStyle(index: number): StyleValue | undefined {
        const from = dragIndex.value
        if (from === null) return undefined
        if (index === from) {
            return {
                transform: `translateY(${offset.value}px)`,
                transition: 'none',
            }
        }
        const to = overIndex.value!
        let shift = 0
        if (from < to && index > from && index <= to) shift = -step
        else if (from > to && index >= to && index < from) shift = step
        return shift ? { transform: `translateY(${shift}px)` } : undefined
    }

    return {
        dragIndex,
        isDragging,
        noTransition,
        onHandlePointerDown,
        rowStyle,
    }
}
