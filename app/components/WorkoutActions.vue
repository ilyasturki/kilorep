<script setup lang="ts">
// Action bar for the workout detail page, rendered both above and below the
// tracking list so a long workout can be finished without scrolling back to the
// top. `foot` flips the divider to the upper edge for the bottom copy.
//
// `editing` (view↔edit) is independent of `completed` (persisted status): a
// finished workout opens read-only and Edit flips `editing` without
// un-completing it. Resume is the explicit, separate action that re-opens it for
// more training, blocked while another workout is already in progress.
defineProps<{
    completed: boolean
    saving: boolean
    resumeBlocked?: boolean
    foot?: boolean
}>()
defineEmits<{ finish: []; resume: [] }>()

// Edit/Done only flip this view↔edit toggle, so the buttons own it directly via
// v-model rather than emitting intent the parent bounces straight back.
const editing = defineModel<boolean>('editing', { required: true })
</script>

<template>
    <div
        class="wk-actions"
        :class="{ 'wk-actions--foot': foot }"
    >
        <!-- In-progress: the one button that completes the workout. -->
        <UiButton
            v-if="editing && !completed"
            type="button"
            class="flex-1"
            :disabled="saving"
            @click="$emit('finish')"
        >
            <Icon
                name="tabler:check"
                :size="16"
            />
            Finish workout
        </UiButton>

        <!-- Editing a finished workout: leave edit mode; it stays completed. -->
        <UiButton
            v-else-if="editing"
            type="button"
            class="flex-1"
            :disabled="saving"
            @click="editing = false"
        >
            <Icon
                name="tabler:check"
                :size="16"
            />
            Done
        </UiButton>

        <!-- Reviewing a finished workout: edit in place, or resume training. -->
        <template v-else>
            <UiButton
                type="button"
                tone="ghost"
                class="flex-1"
                :disabled="saving"
                @click="editing = true"
            >
                <Icon
                    name="tabler:pencil"
                    :size="15"
                />
                Edit
            </UiButton>
            <UiButton
                type="button"
                tone="ghost"
                class="flex-1"
                :disabled="saving || resumeBlocked"
                :title="
                    resumeBlocked ?
                        'Finish your in-progress workout first'
                    :   undefined
                "
                @click="$emit('resume')"
            >
                <Icon
                    name="tabler:player-play-filled"
                    :size="15"
                />
                Resume training
            </UiButton>
            <p
                v-if="resumeBlocked"
                class="wk-actions-hint"
            >
                Finish your in-progress workout first to resume this one.
            </p>
        </template>
    </div>
</template>
