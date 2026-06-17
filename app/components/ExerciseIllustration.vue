<script setup lang="ts">
const props = defineProps<{ name: string }>()

const slug = computed(() => exerciseIllustrationSlug(props.name))

// Inlined (not <img>) so the SVG's currentColor strokes inherit the theme ink.
// A 404 is expected for exercises without an illustration (e.g. custom ones);
// swallow it and render nothing rather than surfacing an error.
const { data: svg } = await useAsyncData(
    `exercise-illu-${slug.value}`,
    () =>
        $fetch<string>(`/illustrations/${slug.value}.svg`, {
            responseType: 'text',
        }).catch(() => null),
    { watch: [slug] },
)
</script>

<template>
    <div
        v-if="svg"
        class="exercise-illu"
        role="img"
        :aria-label="`${name} illustration`"
        v-html="svg"
    />
</template>

<style scoped>
.exercise-illu {
    color: var(--ink-2);
    display: flex;
    justify-content: center;
    padding: 4px 0 8px;
}

.exercise-illu :deep(svg) {
    width: 100%;
    max-width: 260px;
    height: auto;
    display: block;
}
</style>
