<script setup lang="ts">
import { injectNumberFieldRootContext } from 'reka-ui'

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
