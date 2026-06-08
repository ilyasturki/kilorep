<script setup lang="ts">
import type { Exercise, SessionWithEntries } from '~~/server/database/schema'

const [{ data: sessions, status, refresh }, { data: exercises }] =
    await Promise.all([
        useFetch<SessionWithEntries[]>('/api/sessions'),
        useFetch<Exercise[]>('/api/exercises'),
    ])

const exerciseItems = computed(() =>
    (exercises.value ?? []).map((e) => ({ label: e.name, value: e.id })),
)

type SetDraft = { reps: number | null }
type ExerciseDraft = { exerciseId: number | undefined; sets: SetDraft[] }
type EntryDraft = { exercises: ExerciseDraft[] }
type SessionDraft = { name: string; entries: EntryDraft[] }

const newSet = (): SetDraft => ({ reps: 10 })
const newExercise = (): ExerciseDraft => ({
    exerciseId: undefined,
    sets: [newSet()],
})
const newEntry = (exerciseCount = 1): EntryDraft => ({
    exercises: Array.from({ length: exerciseCount }, newExercise),
})
const emptyDraft = (): SessionDraft => ({
    name: '',
    entries: [newEntry()],
})

const draft = ref<SessionDraft>(emptyDraft())
const builderOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const toast = useToast()

function openBuilder() {
    editingId.value = null
    draft.value = emptyDraft()
    builderOpen.value = true
}

function editSession(session: SessionWithEntries) {
    editingId.value = session.id
    draft.value = {
        name: session.name,
        entries: session.entries.map((entry) => ({
            exercises: entry.exercises.map((se) => ({
                exerciseId: se.exerciseId,
                sets: se.sets.map((s) => ({ reps: s.reps })),
            })),
        })),
    }
    builderOpen.value = true
}

function closeBuilder() {
    builderOpen.value = false
    editingId.value = null
}

function addExercise() {
    draft.value.entries.push(newEntry())
}
function addSuperset() {
    draft.value.entries.push(newEntry(2))
}
function removeEntry(index: number) {
    draft.value.entries.splice(index, 1)
}
function addExerciseToEntry(entry: EntryDraft) {
    entry.exercises.push(newExercise())
}
function removeExerciseFromEntry(entry: EntryDraft, index: number) {
    entry.exercises.splice(index, 1)
}
function addSet(exercise: ExerciseDraft) {
    const last = exercise.sets.at(-1)
    exercise.sets.push(last ? { ...last } : newSet())
}
function removeSet(exercise: ExerciseDraft, index: number) {
    exercise.sets.splice(index, 1)
}

async function save() {
    saving.value = true
    try {
        if (editingId.value !== null) {
            await $fetch(`/api/sessions/${editingId.value}`, {
                method: 'PUT',
                body: draft.value,
            })
        } else {
            await $fetch('/api/sessions', {
                method: 'POST',
                body: draft.value,
            })
        }
        closeBuilder()
        await refresh()
        toast.add({ title: 'Session saved', color: 'success' })
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not save the session'),
            color: 'error',
        })
    } finally {
        saving.value = false
    }
}

const deleteTarget = ref<SessionWithEntries | null>(null)
const deleting = ref(false)

async function confirmDelete() {
    if (!deleteTarget.value) return
    deleting.value = true
    try {
        await $fetch(`/api/sessions/${deleteTarget.value.id}`, {
            method: 'DELETE',
        })
        if (editingId.value === deleteTarget.value.id) closeBuilder()
        deleteTarget.value = null
        await refresh()
        toast.add({ title: 'Session deleted', color: 'success' })
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not delete the session'),
            color: 'error',
        })
    } finally {
        deleting.value = false
    }
}

const exerciseName = (id: number) =>
    exercises.value?.find((e) => e.id === id)?.name ?? `#${id}`

// "3 × 8" when every set shares a rep target, otherwise each set's reps.
const setSummary = (sets: { reps: number }[]) => {
    if (sets.length === 0) return ''
    const reps = sets.map((s) => s.reps)
    return reps.every((r) => r === reps[0]) ?
            `${sets.length} × ${reps[0]}`
        :   reps.join(', ')
}
</script>

<template>
    <UContainer class="py-8">
        <div class="mb-6 flex items-end justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold">Sessions</h1>
            </div>
            <UButton
                v-if="!builderOpen"
                icon="i-lucide-plus"
                label="New session"
                @click="openBuilder"
            />
        </div>

        <!-- Builder -->
        <UCard
            v-if="builderOpen"
            class="mb-8"
        >
            <template #header>
                <h2 class="font-semibold">
                    {{ editingId ? 'Edit session' : 'New session' }}
                </h2>
            </template>

            <div class="space-y-4">
                <UFormField
                    label="Name"
                    required
                >
                    <UInput
                        v-model="draft.name"
                        placeholder="Push Day"
                        class="w-full"
                    />
                </UFormField>

                <div class="space-y-3">
                    <div
                        v-for="(entry, entryIndex) in draft.entries"
                        :key="entryIndex"
                        class="rounded-lg border border-default p-3"
                    >
                        <div class="mb-2 flex items-center justify-between">
                            <UBadge
                                :color="
                                    entry.exercises.length > 1 ?
                                        'primary'
                                    :   'neutral'
                                "
                                variant="soft"
                            >
                                {{
                                    entry.exercises.length > 1 ?
                                        'Superset'
                                    :   'Exercise'
                                }}
                            </UBadge>
                            <UButton
                                icon="i-lucide-trash-2"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                @click="removeEntry(entryIndex)"
                            />
                        </div>

                        <div class="space-y-3">
                            <div
                                v-for="(exercise, exIndex) in entry.exercises"
                                :key="exIndex"
                                class="space-y-2"
                            >
                                <div class="flex items-center gap-2">
                                    <USelectMenu
                                        v-model="exercise.exerciseId"
                                        :items="exerciseItems"
                                        value-key="value"
                                        placeholder="Pick an exercise"
                                        class="flex-1"
                                    />
                                    <UButton
                                        v-if="entry.exercises.length > 1"
                                        icon="i-lucide-x"
                                        color="neutral"
                                        variant="ghost"
                                        size="xs"
                                        @click="
                                            removeExerciseFromEntry(
                                                entry,
                                                exIndex,
                                            )
                                        "
                                    />
                                </div>

                                <div class="space-y-1 pl-1">
                                    <div
                                        v-for="(set, setIndex) in exercise.sets"
                                        :key="setIndex"
                                        class="flex items-center gap-2"
                                    >
                                        <span class="text-muted w-10 text-xs">
                                            Set {{ setIndex + 1 }}
                                        </span>
                                        <UInputNumber
                                            v-model="set.reps"
                                            :min="1"
                                            placeholder="reps"
                                            class="w-24"
                                        />
                                        <span class="text-muted text-xs">
                                            reps
                                        </span>
                                        <UButton
                                            v-if="exercise.sets.length > 1"
                                            icon="i-lucide-minus"
                                            color="neutral"
                                            variant="ghost"
                                            size="xs"
                                            @click="
                                                removeSet(exercise, setIndex)
                                            "
                                        />
                                    </div>
                                    <UButton
                                        icon="i-lucide-plus"
                                        label="Add set"
                                        color="neutral"
                                        variant="link"
                                        size="xs"
                                        @click="addSet(exercise)"
                                    />
                                </div>
                            </div>
                        </div>

                        <UButton
                            icon="i-lucide-link"
                            label="Add exercise to superset"
                            color="neutral"
                            variant="link"
                            size="xs"
                            class="mt-2"
                            @click="addExerciseToEntry(entry)"
                        />
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    <UButton
                        icon="i-lucide-plus"
                        label="Add exercise"
                        color="neutral"
                        variant="outline"
                        size="sm"
                        @click="addExercise"
                    />
                    <UButton
                        icon="i-lucide-layers"
                        label="Add superset"
                        color="neutral"
                        variant="outline"
                        size="sm"
                        @click="addSuperset"
                    />
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2">
                    <UButton
                        label="Cancel"
                        color="neutral"
                        variant="ghost"
                        @click="closeBuilder"
                    />
                    <UButton
                        :label="editingId ? 'Save changes' : 'Save session'"
                        icon="i-lucide-check"
                        :loading="saving"
                        @click="save"
                    />
                </div>
            </template>
        </UCard>

        <!-- List -->
        <div
            v-if="status === 'pending'"
            class="text-muted text-sm"
        >
            Loading…
        </div>
        <div
            v-else-if="!sessions?.length"
            class="rounded-lg border border-dashed border-default p-8 text-center"
        >
            <p class="text-muted text-sm">
                No sessions yet. Create your first routine.
            </p>
        </div>
        <div
            v-else
            class="space-y-4"
        >
            <UCard
                v-for="session in sessions"
                :key="session.id"
            >
                <template #header>
                    <div class="flex items-center justify-between gap-4">
                        <h3 class="font-semibold">{{ session.name }}</h3>
                        <div class="flex items-center gap-1">
                            <UButton
                                icon="i-lucide-pencil"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                aria-label="Edit session"
                                @click="editSession(session)"
                            />
                            <UButton
                                icon="i-lucide-trash-2"
                                color="error"
                                variant="ghost"
                                size="xs"
                                aria-label="Delete session"
                                @click="deleteTarget = session"
                            />
                        </div>
                    </div>
                </template>

                <ol class="space-y-2">
                    <li
                        v-for="entry in session.entries"
                        :key="entry.id"
                        class="rounded-md border border-default p-2"
                    >
                        <UBadge
                            v-if="entry.exercises.length > 1"
                            color="primary"
                            variant="soft"
                            size="sm"
                            class="mb-1"
                        >
                            Superset
                        </UBadge>
                        <div
                            v-for="se in entry.exercises"
                            :key="se.id"
                            class="flex items-baseline justify-between gap-3 text-sm"
                        >
                            <span class="font-medium">
                                {{ exerciseName(se.exerciseId) }}
                            </span>
                            <span class="text-muted">
                                {{ setSummary(se.sets) }}
                            </span>
                        </div>
                    </li>
                </ol>
            </UCard>
        </div>

        <UModal
            :open="deleteTarget !== null"
            title="Delete session"
            :description="`Delete “${deleteTarget?.name}”? This can't be undone.`"
            @update:open="deleteTarget = null"
        >
            <template #footer>
                <div class="flex w-full justify-end gap-2">
                    <UButton
                        label="Cancel"
                        color="neutral"
                        variant="ghost"
                        @click="deleteTarget = null"
                    />
                    <UButton
                        label="Delete"
                        color="error"
                        icon="i-lucide-trash-2"
                        :loading="deleting"
                        @click="confirmDelete"
                    />
                </div>
            </template>
        </UModal>
    </UContainer>
</template>
