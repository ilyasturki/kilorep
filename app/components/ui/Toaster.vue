<script setup lang="ts">
import {
    ToastDescription,
    ToastProvider,
    ToastRoot,
    ToastTitle,
    ToastViewport,
} from 'reka-ui'
import { tv } from 'tailwind-variants'

// The left edge carries the status colour; tv() resolves it against the base
// border-l-ink-3 so the two never both apply.
const toast = tv({
    base: 'flex items-center gap-[11px] border border-line-2 border-l-[3px] border-l-ink-3 bg-surface px-[15px] py-[13px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] data-[state=open]:animate-slidein data-[state=closed]:animate-fadeout data-[swipe=end]:animate-fadeout data-[swipe=move]:translate-x-[var(--reka-toast-swipe-move-x)]',
    variants: {
        color: {
            success: 'border-l-accent',
            error: 'border-l-red',
            neutral: '',
        },
    },
})

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
            :class="toast({ color: t.color })"
            @update:open="(open) => !open && remove(t.id)"
        >
            <div>
                <ToastTitle class="text-body font-semibold text-ink">{{
                    t.title
                }}</ToastTitle>
                <ToastDescription
                    v-if="t.description"
                    class="mt-0.5 text-[12.5px] leading-[1.45] text-ink-2"
                >
                    {{ t.description }}
                </ToastDescription>
            </div>
        </ToastRoot>
        <ToastViewport
            class="fixed right-0 bottom-0 z-[80] m-0 flex w-[380px] max-w-[100vw] list-none flex-col gap-2.5 p-[18px] outline-none"
        />
    </ToastProvider>
</template>
