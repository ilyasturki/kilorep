<script setup lang="ts">
import type { Exercise } from '~~/server/database/schema'
import type {
    Equipment,
    ExerciseType,
    MuscleIntensity,
} from '~~/shared/utils/exercise'
import {
    defaultLoadMode,
    EQUIPMENT,
    EXERCISE_TYPES,
    LOAD_MODE_LABELS,
    LOAD_MODES,
    MUSCLE_INTENSITIES,
} from '~~/shared/utils/exercise'
import { exerciseInputSchema } from '~~/shared/validation/exercise'

const props = withDefaults(
    defineProps<{
        // When set, the form edits this exercise (PATCH); otherwise it creates
        // one (POST). Read once at mount, so re-target by remounting (`:key`).
        exercise?: Exercise | null
        // Seed the name field (the combobox passes its unmatched query).
        initialName?: string
        // Focus and select the name field on mount (inline create flow).
        autofocus?: boolean
        // Tighter spacing and narrower selects for the inline combobox variant.
        compact?: boolean
        namePlaceholder?: string
    }>(),
    { namePlaceholder: 'e.g. Barbell Bench Press' },
)

// Emitted on a successful save with the created/updated row; the host decides
// what to do next (refresh its list, select it, close the modal).
const emit = defineEmits<{ saved: [exercise: Exercise] }>()

type MuscleField = { muscle: string; intensity: MuscleIntensity }
const blankMuscle = (): MuscleField => ({ muscle: '', intensity: 'high' })

const ex = props.exercise
const form = reactive({
    name: ex?.name ?? props.initialName?.trim() ?? '',
    equipment: ex?.equipment ?? ('barbell' as Equipment),
    type: ex?.type ?? ('compound' as ExerciseType),
    muscles:
        ex?.muscles.length ?
            ex.muscles.map((m) => ({ ...m }))
        :   [blankMuscle()],
    loadMode: ex?.loadMode ?? defaultLoadMode(ex?.equipment ?? 'barbell'),
})

// While creating, the mode tracks the equipment's default (picking dumbbell
// flips to per-hand) until the user chooses one themselves; editing an
// existing exercise never second-guesses the stored choice.
let loadModeTouched = ex != null
watch(
    () => form.equipment,
    (equipment) => {
        if (!loadModeTouched) form.loadMode = defaultLoadMode(equipment)
    },
)

const toast = useToast()
const invalidate = usePayloadCache()
const submitting = ref(false)
// The same schema the API validates against, so the button can't enable a
// payload the server would reject.
const canSubmit = computed(() => exerciseInputSchema.safeParse(form).success)

function addMuscle() {
    form.muscles.push(blankMuscle())
}

function removeMuscle(index: number) {
    form.muscles.splice(index, 1)
}

async function submit() {
    if (!canSubmit.value || submitting.value) return
    submitting.value = true
    const id = props.exercise?.id ?? null
    try {
        const saved = await $fetch<Exercise>(
            id === null ? '/api/exercises' : `/api/exercises/${id}`,
            {
                method: id === null ? 'POST' : 'PATCH',
                body: {
                    name: form.name.trim(),
                    equipment: form.equipment,
                    type: form.type,
                    muscles: form.muscles.filter((m) => m.muscle),
                    loadMode: form.loadMode,
                },
            },
        )
        // The form is mounted from several pages; the catalog any of them has
        // cached no longer matches.
        invalidate(PAYLOAD.exercises)
        emit('saved', saved)
        toast.add({
            title: id === null ? 'Exercise added' : 'Exercise updated',
            color: 'success',
        })
    } catch (error) {
        toast.add({
            title:
                id === null ?
                    'Could not add exercise'
                :   'Could not update exercise',
            description: errorMessage(error, 'Please try again.'),
            color: 'error',
        })
    } finally {
        submitting.value = false
    }
}

// UiInput is a component, so this holds its instance — focus/select come from
// the methods it exposes, not from the DOM node.
const nameInput = ref<{
    focus: (options?: FocusOptions) => void
    select: () => void
} | null>(null)
onMounted(() => {
    if (!props.autofocus) return
    nameInput.value?.focus()
    nameInput.value?.select()
})

defineExpose({ submit, canSubmit, submitting })
</script>

<template>
    <form
        :class="compact ? 'space-y-3' : 'space-y-4'"
        @submit.prevent="submit"
    >
        <UiField>
            <UiFieldLabel>
                Name <span class="text-accent-ink">*</span>
            </UiFieldLabel>
            <UiInput
                ref="nameInput"
                v-model="form.name"
                :placeholder="namePlaceholder"
                @keydown.enter.prevent="submit"
            />
        </UiField>

        <div
            class="flex flex-wrap items-start"
            :class="compact ? 'gap-x-4 gap-y-3' : 'gap-x-6 gap-y-4'"
        >
            <UiField :class="compact ? 'w-40' : 'w-44'">
                <UiFieldLabel>Equipment</UiFieldLabel>
                <UiSelect
                    v-model="form.equipment"
                    :items="[...EQUIPMENT]"
                />
            </UiField>
            <UiField>
                <UiFieldLabel>Type</UiFieldLabel>
                <UiSegmented>
                    <UiSegmentedOption
                        v-for="t in EXERCISE_TYPES"
                        :key="t"
                        type="button"
                        :active="form.type === t"
                        @click="form.type = t"
                    >
                        {{ t }}
                    </UiSegmentedOption>
                </UiSegmented>
            </UiField>
            <UiField>
                <UiFieldLabel>Kg is</UiFieldLabel>
                <UiSegmented>
                    <UiSegmentedOption
                        v-for="mode in LOAD_MODES"
                        :key="mode"
                        type="button"
                        :active="form.loadMode === mode"
                        @click="
                            ((form.loadMode = mode), (loadModeTouched = true))
                        "
                    >
                        {{ LOAD_MODE_LABELS[mode] }}
                    </UiSegmentedOption>
                </UiSegmented>
            </UiField>
        </div>

        <UiField>
            <UiFieldLabel>
                Muscles <span class="text-accent-ink">*</span>
            </UiFieldLabel>
            <div class="space-y-2">
                <div
                    v-for="(m, index) in form.muscles"
                    :key="index"
                    class="flex gap-2"
                >
                    <div class="min-w-0 flex-1">
                        <UiSelect
                            v-model="m.muscle"
                            :items="muscleOptions"
                            placeholder="Muscle"
                        />
                    </div>
                    <div :class="compact ? 'w-28' : 'w-32'">
                        <UiSelect
                            v-model="m.intensity"
                            :items="[...MUSCLE_INTENSITIES]"
                        />
                    </div>
                    <UiIconButton
                        type="button"
                        :disabled="form.muscles.length === 1"
                        aria-label="Remove muscle"
                        @click="removeMuscle(index)"
                    >
                        <Icon
                            name="tabler:x"
                            :size="16"
                        />
                    </UiIconButton>
                </div>
                <UiButton
                    type="button"
                    tone="link"
                    @click="addMuscle"
                >
                    <Icon
                        name="tabler:plus"
                        :size="14"
                    />
                    Add muscle
                </UiButton>
            </div>
        </UiField>
    </form>
</template>
