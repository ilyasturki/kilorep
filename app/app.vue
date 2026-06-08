<script setup lang="ts">
const links = [
    { label: 'Exercises', to: '/exercises', icon: 'i-lucide-dumbbell' },
    { label: 'Sessions', to: '/sessions', icon: 'i-lucide-list-checks' },
]
</script>

<template>
    <UApp>
        <header class="border-b border-default">
            <UContainer class="flex items-center justify-between gap-4 py-3">
                <span class="font-bold">Workout Manager</span>
                <nav class="flex items-center gap-1">
                    <UButton
                        v-for="link in links"
                        :key="link.to"
                        :to="link.to"
                        :icon="link.icon"
                        :label="link.label"
                        color="neutral"
                        variant="ghost"
                        active-class="text-primary"
                    />
                </nav>
            </UContainer>
        </header>
        <NuxtPage />
    </UApp>
</template>
