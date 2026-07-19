<script setup lang="ts">
import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
} from 'reka-ui'

defineProps<{
    title: string
    description?: string
}>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
    <DialogRoot v-model:open="open">
        <DialogPortal>
            <DialogOverlay
                class="fixed inset-0 z-50 bg-[rgba(0,0,0,0.6)] animate-fade"
            />
            <div
                class="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-6"
            >
                <DialogContent
                    class="pointer-events-auto max-h-[92vh] w-full max-w-[480px] overflow-y-auto border border-line-2 bg-canvas p-[22px] animate-slideup focus:outline-none md:animate-pop"
                >
                    <div class="mb-1 flex items-start justify-between gap-3">
                        <div>
                            <DialogTitle
                                class="text-[22px] font-extrabold tracking-[-0.02em]"
                            >
                                {{ title }}
                            </DialogTitle>
                            <DialogDescription
                                v-if="description"
                                class="mt-1.5 text-body-sm leading-[1.5] text-ink-2"
                            >
                                {{ description }}
                            </DialogDescription>
                        </div>
                        <UiIconButton
                            as-child
                            size="sm"
                        >
                            <DialogClose aria-label="Close">
                                <Icon
                                    name="tabler:x"
                                    :size="18"
                                />
                            </DialogClose>
                        </UiIconButton>
                    </div>

                    <slot />

                    <div
                        v-if="$slots.footer"
                        class="mt-[22px] flex justify-end gap-2.5"
                    >
                        <slot name="footer" />
                    </div>
                </DialogContent>
            </div>
        </DialogPortal>
    </DialogRoot>
</template>
