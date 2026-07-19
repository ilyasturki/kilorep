<script setup lang="ts">
import type { Exercise } from '~~/server/database/schema'

const props = defineProps<{
    exercises: readonly Exercise[]
    placeholder?: string
    // Offer inline "create exercise" affordances in the dropdown. Off by
    // default so pickers like merge (where a brand-new target is meaningless)
    // stay select-only.
    creatable?: boolean
}>()

const model = defineModel<number>()

// The created row is the full inserted exercise; the host page adds it to its
// own list so `items` can render the new selection.
const emit = defineEmits<{ created: [exercise: Exercise] }>()

const byId = computed(() => new Map(props.exercises.map((e) => [e.id, e])))

const items = computed(() =>
    props.exercises.map((e) => ({
        label: e.name,
        value: e.id,
        keywords: exerciseSearchKeywords(e),
    })),
)

const selected = computed(() =>
    model.value === undefined ? undefined : byId.value.get(model.value),
)

const musclesOf = (id: number) => byId.value.get(id)?.muscles ?? []

// Precomputed: the template reads it several times per row on every render.
const topById = computed(
    () =>
        new Map(
            props.exercises.map((e) => [e.id, sortedMuscles(e.muscles)[0]]),
        ),
)
const topOf = (id: number) => topById.value.get(id)

// Inline create swaps the picker for a shared ExerciseForm seeded with the
// unmatched query; the form owns the fields, validation, and POST.
const creating = ref(false)
const createName = ref('')
const createForm = useTemplateRef('createForm')

function startCreate(name = '') {
    createName.value = name.trim()
    creating.value = true
}

function onCreated(exercise: Exercise) {
    // List first, then selection: the host appends `exercise` so its label
    // resolves the moment the picker re-renders on the new id.
    emit('created', exercise)
    model.value = exercise.id
    creating.value = false
}
</script>

<template>
    <div>
        <div
            v-if="!creating"
            class="flex items-center gap-2"
        >
            <MuscleMini
                v-if="selected"
                :muscles="selected.muscles"
            />
            <UiCombobox
                v-model="model"
                :items="items"
                :placeholder="placeholder"
                class="min-w-0 flex-1"
            >
                <template #item="{ option }">
                    <MuscleMini :muscles="musclesOf(option.value)" />
                    <span class="min-w-0 flex-1 truncate">
                        <UiMatchedLabel
                            :label="option.label"
                            :label-positions="option.labelPositions"
                            :keyword="option.matchedKeyword"
                            :keyword-positions="option.keywordPositions"
                        />
                    </span>
                    <span
                        v-if="topOf(option.value)"
                        class="badge flex-none"
                        :class="`badge--${intensityVariant[topOf(option.value)!.intensity]}`"
                    >
                        {{ topOf(option.value)!.muscle }}
                    </span>
                </template>

                <template
                    v-if="creatable"
                    #empty="{ query }"
                >
                    <button
                        v-if="query.trim()"
                        type="button"
                        class="combobox-create"
                        @click="startCreate(query)"
                    >
                        <Icon
                            name="tabler:plus"
                            :size="14"
                        />
                        Create "{{ query.trim() }}"
                    </button>
                    <span
                        v-else
                        class="combobox-empty-text"
                    >
                        No exercises yet
                    </span>
                </template>

                <template
                    v-if="creatable"
                    #footer
                >
                    <button
                        type="button"
                        class="combobox-create"
                        @click="startCreate()"
                    >
                        <Icon
                            name="tabler:plus"
                            :size="14"
                        />
                        New exercise
                    </button>
                </template>
            </UiCombobox>
        </div>

        <div
            v-else
            class="space-y-3"
        >
            <ExerciseForm
                ref="createForm"
                :initial-name="createName"
                autofocus
                compact
                name-placeholder="e.g. Front Squat"
                @saved="onCreated"
            />

            <div class="flex justify-end gap-2 pt-1">
                <UiButton
                    type="button"
                    tone="ghost"
                    @click="creating = false"
                >
                    Cancel
                </UiButton>
                <UiButton
                    type="button"
                    :disabled="!createForm?.canSubmit || createForm?.submitting"
                    @click="createForm?.submit()"
                >
                    <Icon
                        name="tabler:plus"
                        :size="16"
                    />
                    {{ createForm?.submitting ? 'Adding…' : 'Create & select' }}
                </UiButton>
            </div>
        </div>
    </div>
</template>
