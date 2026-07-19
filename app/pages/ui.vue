<script setup lang="ts">
import type { ToastColor } from '~/composables/useToast'

// Internal component showcase for the Lift design system. Kept out of the app
// shell (bare) so components are seen at their own width rather than inside the
// 1080px content column, and disallowed in robots.txt.
definePageMeta({ bare: true })
useHead({ title: 'UI · Kilorep' })

const toast = useToast()

const modalOpen = ref(false)
const segment = ref('all')
const segmentWide = ref('week')
const text = ref('Bench press')
const textSm = ref('')
const weight = ref(82.5)
const reps = ref(8)
const unit = ref('kg')
const muscle = ref('chest')
const exercise = ref('bench')
const day = ref('2026-07-19')

// Replaying an animation means tearing the element out of the DOM and back in;
// a key bump is the cheapest way to do that.
const motionKey = ref(0)

const swatches = [
    { label: 'canvas', cls: 'bg-canvas' },
    { label: 'surface', cls: 'bg-surface' },
    { label: 'surface-2', cls: 'bg-surface-2' },
    { label: 'line', cls: 'bg-line' },
    { label: 'line-2', cls: 'bg-line-2' },
    { label: 'ink', cls: 'bg-ink' },
    { label: 'ink-2', cls: 'bg-ink-2' },
    { label: 'ink-3', cls: 'bg-ink-3' },
    { label: 'accent', cls: 'bg-accent' },
    { label: 'accent-tint', cls: 'bg-accent-tint' },
    { label: 'accent-edge', cls: 'bg-accent-edge' },
    { label: 'on-accent', cls: 'bg-on-accent' },
    { label: 'muscle-low', cls: 'bg-muscle-low' },
    { label: 'muscle-med', cls: 'bg-muscle-med' },
    { label: 'red', cls: 'bg-red' },
    { label: 'on-red', cls: 'bg-on-red' },
] as const

const textSizes = [
    { token: 'text-micro', px: '11px', cls: 'text-micro' },
    { token: 'text-label', px: '12px', cls: 'text-label' },
    { token: 'text-body-sm', px: '13px', cls: 'text-body-sm' },
    { token: 'text-body', px: '14px', cls: 'text-body' },
    { token: 'text-body-lg', px: '15px', cls: 'text-body-lg' },
] as const

const animations = [
    { token: 'animate-fade', note: 'overlay in' },
    { token: 'animate-fadeout', note: 'overlay out' },
    { token: 'animate-pop', note: 'dialog in' },
    { token: 'animate-slideup', note: 'sheet in' },
    { token: 'animate-slidein', note: 'toast in' },
] as const

const unitOptions = ['kg', 'lb']

const muscleOptions = [
    { label: 'Chest', value: 'chest' },
    { label: 'Back', value: 'back' },
    { label: 'Quads', value: 'quads' },
    { label: 'Hamstrings', value: 'hamstrings', disabled: true },
] as const

const exerciseOptions = [
    { label: 'Bench press', value: 'bench', keywords: ['bp', 'flat bench'] },
    { label: 'Incline dumbbell press', value: 'incline', keywords: ['idb'] },
    { label: 'Barbell row', value: 'row', keywords: ['bb row'] },
    { label: 'Romanian deadlift', value: 'rdl', keywords: ['rdl'] },
    { label: 'Overhead press', value: 'ohp', keywords: ['ohp', 'military'] },
]

function fireToast(color: ToastColor) {
    const copy = {
        success: { title: 'Session saved', description: '5 exercises logged' },
        error: {
            title: 'Could not save',
            description: 'Check your connection',
        },
        neutral: { title: 'Draft kept', description: undefined },
    }[color]
    toast.add({ ...copy, color })
}
</script>

<template>
    <div class="min-h-dvh bg-canvas text-ink">
        <div class="mx-auto flex max-w-[1080px] flex-col gap-11 px-5 py-9">
            <header class="flex flex-col gap-3 border-b border-line-2 pb-7">
                <span class="flex items-center gap-3">
                    <UiLogo class="size-[30px] text-accent" />
                    <span class="text-[24px] font-extrabold tracking-[-0.03em]">
                        Lift
                    </span>
                </span>
                <p class="max-w-lg text-body text-balance text-ink-2">
                    Brutalist-sharp design system for Kilorep. Dark-first,
                    near-square corners, hairline borders, one volt accent.
                    Theme follows the system color scheme.
                </p>
            </header>

            <section class="flex flex-col gap-4">
                <h2 class="kicker">Colors</h2>
                <div class="grid grid-cols-4 gap-3 md:grid-cols-8">
                    <div
                        v-for="s in swatches"
                        :key="s.label"
                        class="flex flex-col gap-1.5"
                    >
                        <div :class="['h-12 border border-line-2', s.cls]" />
                        <span class="mono text-[10px] text-ink-3">
                            {{ s.label }}
                        </span>
                    </div>
                </div>
            </section>

            <section class="flex flex-col gap-4">
                <h2 class="kicker">Typography</h2>
                <div class="flex flex-col gap-5">
                    <div class="flex flex-col gap-1">
                        <div
                            class="text-[30px] font-extrabold tracking-[-0.03em]"
                        >
                            Archivo, variable weight
                        </div>
                        <span class="mono text-[10px] text-ink-3">
                            font-body
                        </span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <div class="mono text-[22px] font-semibold">
                            82.5 kg × 8
                        </div>
                        <span class="mono text-[10px] text-ink-3">
                            font-mono, tabular figures via the mono utility
                        </span>
                    </div>
                    <div
                        class="flex flex-col gap-2.5 border-t border-line pt-4"
                    >
                        <div
                            v-for="t in textSizes"
                            :key="t.token"
                            class="flex items-baseline gap-3"
                        >
                            <span
                                class="mono w-28 flex-none text-[10px] text-ink-3"
                            >
                                {{ t.token }}
                            </span>
                            <span :class="t.cls"> Progressive overload </span>
                            <span class="mono text-[10px] text-ink-3">
                                {{ t.px }}
                            </span>
                        </div>
                    </div>
                    <div
                        class="flex items-baseline gap-3 border-t border-line pt-4"
                    >
                        <span
                            class="mono w-28 flex-none text-[10px] text-ink-3"
                        >
                            kicker
                        </span>
                        <span class="kicker">Section label</span>
                    </div>
                </div>
            </section>

            <section class="flex flex-col gap-4">
                <div class="flex items-center justify-between gap-3">
                    <h2 class="kicker">Motion</h2>
                    <UiButton
                        tone="ghost"
                        size="sm"
                        @click="motionKey++"
                    >
                        <Icon
                            name="tabler:refresh"
                            :size="15"
                        />
                        Replay
                    </UiButton>
                </div>
                <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <div
                        v-for="a in animations"
                        :key="a.token"
                        class="flex flex-col gap-1.5 overflow-hidden"
                    >
                        <div
                            :key="`${a.token}-${motionKey}`"
                            :class="[
                                'grid h-16 place-items-center border border-line-2 bg-surface',
                                a.token,
                            ]"
                        >
                            <span class="mono text-[10px] text-ink-2">
                                {{ a.note }}
                            </span>
                        </div>
                        <span class="mono text-[10px] text-ink-3">
                            {{ a.token }}
                        </span>
                    </div>
                </div>
            </section>

            <section class="flex flex-col gap-4">
                <h2 class="kicker">Buttons</h2>
                <div class="flex flex-wrap items-center gap-2.5">
                    <UiButton>Start session</UiButton>
                    <UiButton tone="ghost">Add exercise</UiButton>
                    <UiButton tone="danger">Delete</UiButton>
                    <UiButton tone="link">
                        View history
                        <Icon
                            name="tabler:arrow-right"
                            :size="14"
                        />
                    </UiButton>
                </div>
                <div class="flex flex-wrap items-center gap-2.5">
                    <UiButton
                        tone="ghost"
                        size="sm"
                    >
                        Ghost sm
                    </UiButton>
                    <UiButton disabled>Disabled primary</UiButton>
                    <UiButton
                        tone="ghost"
                        disabled
                    >
                        Disabled ghost
                    </UiButton>
                </div>
                <div class="max-w-sm">
                    <UiButton size="lg">Finish workout</UiButton>
                </div>
                <div
                    class="flex flex-wrap items-center gap-2.5 border-t border-line pt-4"
                >
                    <UiIconButton aria-label="Edit">
                        <Icon
                            name="tabler:pencil"
                            :size="17"
                        />
                    </UiIconButton>
                    <UiIconButton
                        size="sm"
                        aria-label="Move up"
                    >
                        <Icon
                            name="tabler:chevron-up"
                            :size="15"
                        />
                    </UiIconButton>
                    <UiIconButton
                        tone="danger"
                        aria-label="Remove"
                    >
                        <Icon
                            name="tabler:trash"
                            :size="17"
                        />
                    </UiIconButton>
                    <UiIconButton
                        disabled
                        aria-label="Disabled"
                    >
                        <Icon
                            name="tabler:chevron-down"
                            :size="17"
                        />
                    </UiIconButton>
                </div>
            </section>

            <section class="flex flex-col gap-4">
                <h2 class="kicker">Tags and badges</h2>
                <div class="flex flex-wrap items-center gap-2.5">
                    <UiTag>3 exercises</UiTag>
                    <UiTag accent>Active</UiTag>
                    <UiTag size="lg">
                        <Icon
                            name="tabler:calendar"
                            :size="13"
                        />
                        Push day
                    </UiTag>
                </div>
                <div class="flex flex-wrap items-center gap-2.5">
                    <UiBadge variant="solid">chest</UiBadge>
                    <UiBadge variant="soft">triceps</UiBadge>
                    <UiBadge variant="outline">front delts</UiBadge>
                </div>
            </section>

            <section class="flex flex-col gap-4">
                <h2 class="kicker">Segmented</h2>
                <!-- Wrapped: the group is inline-flex, so a bare flex-column
                     child would stretch to the section width and hide that. -->
                <div>
                    <UiSegmented>
                        <UiSegmentedOption
                            v-for="opt in ['all', 'push', 'pull', 'legs']"
                            :key="opt"
                            :active="segment === opt"
                            @click="segment = opt"
                        >
                            {{ opt }}
                        </UiSegmentedOption>
                    </UiSegmented>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <UiSegmented stretch>
                        <UiSegmentedOption
                            v-for="opt in ['week', 'month', 'year']"
                            :key="opt"
                            :active="segmentWide === opt"
                            @click="segmentWide = opt"
                        >
                            {{ opt }}
                        </UiSegmentedOption>
                    </UiSegmented>
                    <span class="mono text-[10px] text-ink-3">
                        stretch, fills the row below md
                    </span>
                </div>
            </section>

            <section class="flex flex-col gap-4">
                <h2 class="kicker">Cards</h2>
                <div class="grid gap-4 lg:grid-cols-2">
                    <UiCard>
                        <UiCardHead>
                            <span class="text-body-lg font-bold">
                                Upper body A
                            </span>
                            <UiTag accent>Template</UiTag>
                        </UiCardHead>
                        <p class="mt-3 text-body text-ink-2">
                            A card with a head row and an action footer. The
                            buttons carry flex-1 themselves.
                        </p>
                        <UiCardActions>
                            <UiButton class="flex-1">Start</UiButton>
                            <UiButton
                                tone="ghost"
                                class="flex-1"
                            >
                                Edit
                            </UiButton>
                        </UiCardActions>
                    </UiCard>

                    <UiCard>
                        <div class="grid grid-cols-3 gap-4">
                            <UiStat>
                                <template #value>82.5</template>
                                <template #label>CURRENT · KG</template>
                            </UiStat>
                            <UiStat>
                                <template #value>-1.4</template>
                                <template #label>CHANGE · 30D</template>
                            </UiStat>
                            <UiStat>
                                <template #value>78.2</template>
                                <template #label>LOWEST · KG</template>
                            </UiStat>
                        </div>
                    </UiCard>
                </div>
                <UiEmpty>No sessions logged yet.</UiEmpty>
            </section>

            <section class="flex flex-col gap-4">
                <h2 class="kicker">Fields</h2>
                <div class="grid gap-5 lg:grid-cols-2">
                    <UiField>
                        <UiFieldLabel for="ui-name">Exercise</UiFieldLabel>
                        <UiInput
                            id="ui-name"
                            v-model="text"
                        />
                    </UiField>

                    <UiField>
                        <UiFieldLabel for="ui-note">Note (sm)</UiFieldLabel>
                        <UiInput
                            id="ui-note"
                            v-model="textSm"
                            size="sm"
                            placeholder="Felt heavy"
                        />
                    </UiField>

                    <UiField>
                        <UiFieldLabel>Weight</UiFieldLabel>
                        <UiNumberField
                            v-model="weight"
                            :min="0"
                            :step="2.5"
                            :step-snapping="false"
                        />
                    </UiField>

                    <UiField>
                        <UiFieldLabel>Reps</UiFieldLabel>
                        <UiNumberField
                            v-model="reps"
                            :min="1"
                        />
                    </UiField>

                    <UiField>
                        <UiFieldLabel>Unit (plain values)</UiFieldLabel>
                        <UiSelect
                            v-model="unit"
                            :items="unitOptions"
                        />
                    </UiField>

                    <UiField>
                        <UiFieldLabel
                            >Muscle (options, one disabled)</UiFieldLabel
                        >
                        <UiSelect
                            v-model="muscle"
                            :items="muscleOptions"
                            placeholder="Pick a muscle"
                        />
                    </UiField>

                    <UiField>
                        <UiFieldLabel>Exercise search (fuzzy)</UiFieldLabel>
                        <UiCombobox
                            v-model="exercise"
                            :items="exerciseOptions"
                            placeholder="Type bp or ohp"
                        />
                    </UiField>

                    <UiField>
                        <UiFieldLabel>Date</UiFieldLabel>
                        <UiDatePicker
                            v-model="day"
                            aria-label="Session date"
                        />
                    </UiField>
                </div>
            </section>

            <section class="flex flex-col gap-4">
                <h2 class="kicker">Overlays</h2>
                <div class="flex flex-wrap items-center gap-2.5">
                    <UiButton
                        tone="ghost"
                        @click="modalOpen = true"
                    >
                        Open modal
                    </UiButton>
                    <UiButton
                        tone="ghost"
                        @click="fireToast('success')"
                    >
                        Toast success
                    </UiButton>
                    <UiButton
                        tone="ghost"
                        @click="fireToast('error')"
                    >
                        Toast error
                    </UiButton>
                    <UiButton
                        tone="ghost"
                        @click="fireToast('neutral')"
                    >
                        Toast neutral
                    </UiButton>
                </div>
                <UiModal
                    v-model:open="modalOpen"
                    title="Delete workout"
                    description="This removes the session and every set logged against it."
                >
                    <p class="text-body text-ink-2">
                        Modal body content goes in the default slot; the actions
                        below sit in the footer slot.
                    </p>
                    <template #footer>
                        <UiButton
                            tone="ghost"
                            @click="modalOpen = false"
                        >
                            Cancel
                        </UiButton>
                        <UiButton
                            tone="danger"
                            @click="modalOpen = false"
                        >
                            Delete
                        </UiButton>
                    </template>
                </UiModal>
            </section>

            <section class="flex flex-col gap-4">
                <h2 class="kicker">Plan readout</h2>
                <UiCard>
                    <UiPlanBlock>
                        <UiPlanExercise
                            index="1"
                            name="Bench press"
                            target="4 × 6"
                        />
                    </UiPlanBlock>
                    <UiPlanBlock>
                        <UiPlanExercise
                            index="2"
                            name="Incline dumbbell press"
                            target="3 × 10"
                            to="/exercises"
                        />
                    </UiPlanBlock>
                    <UiPlanBlock superset>
                        <UiPlanExercise
                            index="3a"
                            name="Cable fly"
                            target="3 × 12"
                        />
                        <UiPlanExercise
                            index="3b"
                            name="Triceps pushdown"
                            target="3 × 12"
                        />
                    </UiPlanBlock>
                </UiCard>
            </section>

            <section class="flex flex-col gap-4 pb-6">
                <h2 class="kicker">Search result text</h2>
                <div class="flex flex-col gap-2.5">
                    <div class="text-body">
                        <UiHighlight
                            text="Romanian deadlift"
                            :positions="[0, 1, 9, 10]"
                        />
                    </div>
                    <div class="text-body">
                        <UiMatchedLabel
                            label="Overhead press"
                            :label-positions="[0]"
                            keyword="ohp"
                            :keyword-positions="[0, 1, 2]"
                        />
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>
