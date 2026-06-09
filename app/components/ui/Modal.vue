<script setup lang="ts">
import { X } from 'lucide-vue-next'
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
            <DialogOverlay class="modal-scrim" />
            <div class="modal-wrap">
                <DialogContent class="modal">
                    <div class="modal-head">
                        <div>
                            <DialogTitle class="modal-title">
                                {{ title }}
                            </DialogTitle>
                            <DialogDescription
                                v-if="description"
                                class="modal-sub"
                            >
                                {{ description }}
                            </DialogDescription>
                        </div>
                        <DialogClose
                            class="icon-btn sm"
                            aria-label="Close"
                        >
                            <X :size="18" />
                        </DialogClose>
                    </div>

                    <slot />

                    <div
                        v-if="$slots.footer"
                        class="modal-foot"
                    >
                        <slot name="footer" />
                    </div>
                </DialogContent>
            </div>
        </DialogPortal>
    </DialogRoot>
</template>
