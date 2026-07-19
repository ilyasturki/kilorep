<script setup lang="ts">
const props = defineProps<{
    // What the arrows move ("block", "session"…) — only read by aria-labels.
    label: string
    canUp: boolean
    canDown: boolean
}>()

const emit = defineEmits<{ move: [dir: -1 | 1] }>()

// UiIconButton is a component, so a template ref holds its instance rather than
// the DOM node — focus() has to go through $el.
const upBtn = ref<ComponentPublicInstance | null>(null)
const downBtn = ref<ComponentPublicInstance | null>(null)

function focusBtn(btn: typeof upBtn) {
    ;(btn.value?.$el as HTMLElement | undefined)?.focus()
}

// Keep focus on the arrows of the item that just moved, so repeated taps walk it
// several rows without reaching for the mouse again. Stable v-for keys already
// carry DOM focus through the reorder, but the pressed arrow disables at an end
// (and both disable while the session list saves over the network) — so re-aim
// focus once the buttons settle, retrying via the watcher when a move persists
// asynchronously and the buttons are still disabled on the next tick.
let pending: -1 | 1 | null = null

function onMove(dir: -1 | 1) {
    pending = dir
    emit('move', dir)
    nextTick(applyFocus)
}

function applyFocus() {
    if (pending === null) return
    const preferUp = pending === -1
    if (preferUp && props.canUp) focusBtn(upBtn)
    else if (!preferUp && props.canDown) focusBtn(downBtn)
    else if (props.canUp) focusBtn(upBtn)
    else if (props.canDown) focusBtn(downBtn)
    else return // both disabled (save in flight) — the watcher retries on settle
    pending = null
}

// flush: 'post' so the callback runs after the DOM re-enables the buttons —
// a 'pre' watcher would call focus() while the button still carries the
// disabled attribute (the network save just cleared), and focus would no-op.
watch(
    [() => props.canUp, () => props.canDown],
    () => {
        if (pending !== null) applyFocus()
    },
    { flush: 'post' },
)
</script>

<template>
    <UiIconButton
        ref="upBtn"
        type="button"
        size="sm"
        :aria-label="`Move ${label} up`"
        :disabled="!canUp"
        @click="onMove(-1)"
    >
        <Icon
            name="tabler:arrow-up"
            :size="15"
        />
    </UiIconButton>
    <UiIconButton
        ref="downBtn"
        type="button"
        size="sm"
        :aria-label="`Move ${label} down`"
        :disabled="!canDown"
        @click="onMove(1)"
    >
        <Icon
            name="tabler:arrow-down"
            :size="15"
        />
    </UiIconButton>
</template>
