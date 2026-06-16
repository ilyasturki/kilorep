<script setup lang="ts">
import type { SessionWithEntries } from '~~/server/database/schema'

// Two surfaces render this: the desktop sidebar (variant 'sidebar', collapses to
// an icon) and the Workouts page header (variant 'page'). It flips to "Continue
// workout" whenever an unfinished workout exists, otherwise opens the template
// picker in place. inheritAttrs is off so the two-root template (button + modal)
// doesn't ambiguously spread a parent class.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
    defineProps<{ variant?: 'sidebar' | 'page'; collapsed?: boolean }>(),
    { variant: 'page', collapsed: false },
)

const { active, refresh } = useActiveWorkout()
const toast = useToast()

const cls = computed(() =>
    props.variant === 'sidebar' ? 'side-cta' : 'btn-primary',
)
const iconSize = computed(() => (props.variant === 'sidebar' ? 20 : 16))
const iconOnly = computed(() => props.variant === 'sidebar' && props.collapsed)

const pickerOpen = ref(false)
const starting = ref(false)

// Templates are only needed once the picker opens, so they're fetched on demand
// rather than on every page that mounts the sidebar.
const sessions = ref<SessionWithEntries[] | null>(null)
const sessionsLoading = ref(false)

async function openPicker() {
    pickerOpen.value = true
    if (sessions.value) return
    sessionsLoading.value = true
    try {
        sessions.value = await $fetch<SessionWithEntries[]>('/api/sessions')
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not load sessions'),
            color: 'error',
        })
    } finally {
        sessionsLoading.value = false
    }
}

const sessionSummary = (s: SessionWithEntries) => {
    const count = s.entries.reduce((n, e) => n + e.exercises.length, 0)
    return plural(count, 'exercise')
}

async function startWorkout(sessionId: number) {
    starting.value = true
    try {
        const workout = await $fetch('/api/workouts', {
            method: 'POST',
            body: { sessionId },
        })
        pickerOpen.value = false
        await refresh()
        await navigateTo(`/workouts/${workout.id}`)
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not start the workout'),
            color: 'error',
        })
    } finally {
        starting.value = false
    }
}
</script>

<template>
    <NuxtLink
        v-if="active"
        :to="`/workouts/${active.id}`"
        :class="cls"
        :title="iconOnly ? 'Continue workout' : undefined"
    >
        <Icon
            name="tabler:player-play-filled"
            :size="iconSize"
        />
        <span v-if="!iconOnly">Continue workout</span>
    </NuxtLink>
    <button
        v-else
        type="button"
        :class="cls"
        :title="iconOnly ? 'Start workout' : undefined"
        @click="openPicker"
    >
        <Icon
            name="tabler:plus"
            :size="iconSize"
        />
        <span v-if="!iconOnly">Start workout</span>
    </button>

    <UiModal
        v-model:open="pickerOpen"
        title="Start workout"
        description="Pick a session template to begin tracking."
    >
        <div
            v-if="sessionsLoading"
            class="empty"
        >
            Loading…
        </div>
        <div
            v-else-if="!sessions?.length"
            class="empty"
        >
            No templates yet.
            <NuxtLink
                to="/sessions"
                class="kicker--accent"
            >
                Create a session
            </NuxtLink>
            first.
        </div>
        <div
            v-else
            class="space-y-2"
        >
            <button
                v-for="s in sessions"
                :key="s.id"
                type="button"
                class="btn-ghost w-full justify-between"
                :disabled="starting"
                @click="startWorkout(s.id)"
            >
                <span class="font-semibold">{{ s.name }}</span>
                <span class="kicker">{{ sessionSummary(s) }}</span>
            </button>
        </div>
    </UiModal>
</template>
