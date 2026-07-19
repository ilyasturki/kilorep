<script setup lang="ts">
import { injectNumberFieldRootContext } from 'reka-ui'
import { tv } from 'tailwind-variants'

// border-0 rather than border-none: the divider below sets a width on one side,
// which a `border-style: none` base would zero out.
const step_ = tv({
    base: 'inline-flex h-[38px] w-9 flex-none items-center justify-center border-0 bg-transparent text-ink-2 transition-[background,color] duration-[120ms] [touch-action:manipulation] hover:bg-surface-2 hover:text-ink',
    variants: {
        // Decrease sits first in the field, increase last; each takes the
        // divider on its inner edge.
        dir: {
            dec: 'border-r border-r-line',
            inc: 'border-l border-l-line',
        },
    },
})

const props = defineProps<{ dir: 'inc' | 'dec' }>()

// Reuse the Root's own stepping (clamp, step-snapping, empty -> min, min/max
// disable) instead of reimplementing it, so taps match the keyboard/wheel path.
const root = injectNumberFieldRootContext()

const disabled = computed(() =>
    props.dir === 'inc' ?
        root.isIncreaseDisabled.value
    :   root.isDecreaseDisabled.value,
)

// Fire on click, not pointerdown like reka's own stepper: the browser cancels a
// click when the touch turns into a scroll, so scrolling with a thumb over the
// +/- no longer nudges the value. Cost: no press-and-hold to repeat.
function step() {
    if (props.dir === 'inc') root.handleIncrease()
    else root.handleDecrease()
}
</script>

<template>
    <button
        type="button"
        :class="step_({ dir })"
        tabindex="-1"
        :aria-label="dir === 'inc' ? 'Increase' : 'Decrease'"
        :disabled="disabled"
        @click="step"
        @contextmenu.prevent
    >
        <Icon
            :name="dir === 'inc' ? 'tabler:plus' : 'tabler:minus'"
            :size="15"
        />
    </button>
</template>
