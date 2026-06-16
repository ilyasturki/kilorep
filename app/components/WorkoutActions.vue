<script setup lang="ts">
// Finish/reopen bar, rendered both above and below the tracking list so a long
// workout can be finished without scrolling back to the top. `foot` flips the
// divider to the upper edge for the bottom copy.
defineProps<{ editing: boolean; saving: boolean; foot?: boolean }>()
defineEmits<{ finish: []; reopen: [] }>()
</script>

<template>
    <div
        class="wk-actions"
        :class="{ 'wk-actions--foot': foot }"
    >
        <button
            v-if="editing"
            type="button"
            class="btn-primary"
            :disabled="saving"
            @click="$emit('finish')"
        >
            <Icon
                name="tabler:check"
                :size="16"
            />
            Finish workout
        </button>
        <button
            v-else
            type="button"
            class="btn-ghost"
            :disabled="saving"
            @click="$emit('reopen')"
        >
            <Icon
                name="tabler:pencil"
                :size="15"
            />
            Reopen to edit
        </button>
    </div>
</template>
