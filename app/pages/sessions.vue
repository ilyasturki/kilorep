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

type SetDraft = { reps: number }
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

// Flatten a session into display blocks, numbering exercises 01..N across the
// whole session (superset members included) like the design's plan readout.
function planBlocks(session: SessionWithEntries) {
    let n = 0
    return session.entries.map((entry) => ({
        key: entry.id,
        isSuperset: entry.exercises.length > 1,
        exercises: entry.exercises.map((se) => ({
            key: se.id,
            n: ++n,
            name: exerciseName(se.exerciseId),
            summary: setSummary(se.sets),
        })),
    }))
}
</script>

<template>
    <div>
        <div class="mb-5 flex items-end justify-end gap-4">
            <button
                v-if="!builderOpen"
                type="button"
                class="btn-primary"
                @click="openBuilder"
            >
                <Icon
                    name="tabler:plus"
                    :size="16"
                />
                New session
            </button>
        </div>

        <!-- Builder -->
        <div
            v-if="builderOpen"
            class="card mb-8"
        >
            <div class="card-head mb-4">
                <span class="kicker kicker--accent">
                    {{ editingId ? 'Edit session' : 'New session' }}
                </span>
            </div>

            <div class="space-y-4">
                <div class="field">
                    <label class="field-label">
                        Name <span class="req">*</span>
                    </label>
                    <input
                        v-model="draft.name"
                        class="input"
                        placeholder="Push Day"
                    />
                </div>

                <div class="space-y-3">
                    <div
                        v-for="(entry, entryIndex) in draft.entries"
                        :key="entryIndex"
                        class="builder-block"
                        :class="{
                            'builder-block--ss': entry.exercises.length > 1,
                        }"
                    >
                        <div class="mb-3 flex items-center justify-between">
                            <span class="tag">
                                {{
                                    entry.exercises.length > 1 ?
                                        'Superset'
                                    :   'Exercise'
                                }}
                            </span>
                            <button
                                type="button"
                                class="icon-btn sm icon-btn--danger"
                                aria-label="Remove block"
                                @click="removeEntry(entryIndex)"
                            >
                                <Icon
                                    name="tabler:trash"
                                    :size="15"
                                />
                            </button>
                        </div>

                        <div class="space-y-4">
                            <div
                                v-for="(exercise, exIndex) in entry.exercises"
                                :key="exIndex"
                                class="space-y-2"
                            >
                                <div class="flex items-center gap-2">
                                    <div class="min-w-0 flex-1">
                                        <UiSelect
                                            v-model="exercise.exerciseId"
                                            :items="exerciseItems"
                                            placeholder="Pick an exercise"
                                        />
                                    </div>
                                    <button
                                        v-if="entry.exercises.length > 1"
                                        type="button"
                                        class="icon-btn"
                                        aria-label="Remove exercise"
                                        @click="
                                            removeExerciseFromEntry(
                                                entry,
                                                exIndex,
                                            )
                                        "
                                    >
                                        <Icon
                                            name="tabler:x"
                                            :size="16"
                                        />
                                    </button>
                                </div>

                                <div class="space-y-2 pl-1">
                                    <div
                                        v-for="(set, setIndex) in exercise.sets"
                                        :key="setIndex"
                                        class="set-row"
                                    >
                                        <span class="set-lab">
                                            SET {{ setIndex + 1 }}
                                        </span>
                                        <UiNumberField
                                            v-model="set.reps"
                                            :min="1"
                                        />
                                        <span class="set-lab">reps</span>
                                        <button
                                            v-if="exercise.sets.length > 1"
                                            type="button"
                                            class="icon-btn sm"
                                            aria-label="Remove set"
                                            @click="
                                                removeSet(exercise, setIndex)
                                            "
                                        >
                                            <Icon
                                                name="tabler:minus"
                                                :size="15"
                                            />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        class="btn-link"
                                        @click="addSet(exercise)"
                                    >
                                        <Icon
                                            name="tabler:plus"
                                            :size="14"
                                        />
                                        Add set
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="btn-link mt-3"
                            @click="addExerciseToEntry(entry)"
                        >
                            <Icon
                                name="tabler:link"
                                :size="14"
                            />
                            Add exercise to superset
                        </button>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="btn-ghost sm"
                        @click="addExercise"
                    >
                        <Icon
                            name="tabler:plus"
                            :size="15"
                        />
                        Add exercise
                    </button>
                    <button
                        type="button"
                        class="btn-ghost sm"
                        @click="addSuperset"
                    >
                        <Icon
                            name="tabler:stack-2"
                            :size="15"
                        />
                        Add superset
                    </button>
                </div>
            </div>

            <div class="modal-foot">
                <button
                    type="button"
                    class="btn-ghost"
                    @click="closeBuilder"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="saving"
                    @click="save"
                >
                    <Icon
                        name="tabler:check"
                        :size="16"
                    />
                    {{
                        saving ? 'Saving…'
                        : editingId ? 'Save changes'
                        : 'Save session'
                    }}
                </button>
            </div>
        </div>

        <!-- List -->
        <div
            v-if="status === 'pending' && !sessions?.length"
            class="empty"
        >
            Loading…
        </div>
        <div
            v-else-if="!sessions?.length"
            class="empty"
        >
            No sessions yet. Create your first routine.
        </div>
        <div
            v-else
            class="space-y-4"
        >
            <div
                v-for="session in sessions"
                :key="session.id"
                class="card"
            >
                <div class="card-head">
                    <h3 class="session-name">{{ session.name }}</h3>
                    <div class="flex items-center gap-1">
                        <button
                            type="button"
                            class="icon-btn sm"
                            aria-label="Edit session"
                            @click="editSession(session)"
                        >
                            <Icon
                                name="tabler:pencil"
                                :size="15"
                            />
                        </button>
                        <button
                            type="button"
                            class="icon-btn sm icon-btn--danger"
                            aria-label="Delete session"
                            @click="deleteTarget = session"
                        >
                            <Icon
                                name="tabler:trash"
                                :size="15"
                            />
                        </button>
                    </div>
                </div>

                <div class="plan-list">
                    <div
                        v-for="block in planBlocks(session)"
                        :key="block.key"
                        class="plan-block"
                        :class="{ 'plan-block--ss': block.isSuperset }"
                    >
                        <span
                            v-if="block.isSuperset"
                            class="ss-tag"
                        >
                            SUPERSET
                        </span>
                        <div
                            v-for="ex in block.exercises"
                            :key="ex.key"
                            class="plan-ex"
                        >
                            <span class="plan-ex-idx">
                                {{ String(ex.n).padStart(2, '0') }}
                            </span>
                            <span class="plan-ex-name">{{ ex.name }}</span>
                            <span class="plan-ex-target">{{ ex.summary }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete session -->
        <UiModal
            :open="deleteTarget !== null"
            title="Delete session"
            :description="`Delete “${deleteTarget?.name}”? This can't be undone.`"
            @update:open="(open) => !open && (deleteTarget = null)"
        >
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="deleteTarget = null"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-danger"
                    :disabled="deleting"
                    @click="confirmDelete"
                >
                    <Icon
                        name="tabler:trash"
                        :size="15"
                    />
                    {{ deleting ? 'Deleting…' : 'Delete' }}
                </button>
            </template>
        </UiModal>
    </div>
</template>
