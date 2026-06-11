<script setup lang="ts">
defineProps<{ muscles: string[] }>()

// Fill encodes rank (leader solid, then fading) — echoing how the exercise
// page's badges encode intensity, so the visual language stays single.
const rankVariant = ['solid', 'soft', 'outline'] as const
</script>

<template>
    <div
        v-if="muscles.length"
        class="xmuscles"
    >
        <span
            v-for="(muscle, index) in muscles"
            :key="muscle"
            class="badge"
            :class="`badge--${rankVariant[index] ?? 'outline'}`"
        >
            {{ muscle }}
        </span>
    </div>
</template>
