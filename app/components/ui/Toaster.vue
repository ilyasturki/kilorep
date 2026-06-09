<script setup lang="ts">
import {
    ToastDescription,
    ToastProvider,
    ToastRoot,
    ToastTitle,
    ToastViewport,
} from 'reka-ui'

const { toasts, remove } = useToast()
</script>

<template>
    <ToastProvider
        :duration="3500"
        swipe-direction="right"
    >
        <ToastRoot
            v-for="t in toasts"
            :key="t.id"
            :class="['toast', `toast--${t.color}`]"
            @update:open="(open) => !open && remove(t.id)"
        >
            <div>
                <ToastTitle class="toast-title">{{ t.title }}</ToastTitle>
                <ToastDescription
                    v-if="t.description"
                    class="toast-desc"
                >
                    {{ t.description }}
                </ToastDescription>
            </div>
        </ToastRoot>
        <ToastViewport class="toast-viewport" />
    </ToastProvider>
</template>
