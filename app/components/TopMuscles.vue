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
        <UiBadge
            v-for="(muscle, index) in muscles"
            :key="muscle"
            :variant="rankVariant[index] ?? 'outline'"
        >
            {{ muscle }}
        </UiBadge>
    </div>
</template>
