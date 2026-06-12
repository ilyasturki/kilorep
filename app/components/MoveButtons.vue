<script setup lang="ts">
defineProps<{
    // What the arrows move ("block", "session"…) — only read by aria-labels.
    label: string
    canUp: boolean
    canDown: boolean
}>()

const emit = defineEmits<{ move: [dir: -1 | 1] }>()
</script>

<template>
    <button
        type="button"
        class="icon-btn sm"
        :aria-label="`Move ${label} up`"
        :disabled="!canUp"
        @click="emit('move', -1)"
    >
        <Icon
            name="tabler:arrow-up"
            :size="15"
        />
    </button>
    <button
        type="button"
        class="icon-btn sm"
        :aria-label="`Move ${label} down`"
        :disabled="!canDown"
        @click="emit('move', 1)"
    >
        <Icon
            name="tabler:arrow-down"
            :size="15"
        />
    </button>
</template>
