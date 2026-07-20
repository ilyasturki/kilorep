import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

import { IconX } from '../lib/icons'
import { IconButton } from './IconButton'

/**
 * Centred dialog on desktop, bottom sheet on mobile. Always carries a title and
 * a close affordance; `footer` is where actions go (right-aligned, 10px gap).
 */
export interface ModalProps {
    title: string
    description?: string
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /** Right-aligned action row. Omitted entirely when not provided. */
    footer?: ReactNode
    children?: ReactNode
}

export function Modal({
    title,
    description,
    open = false,
    onOpenChange,
    footer,
    children,
}: ModalProps) {
    return (
        <Dialog.Root
            open={open}
            onOpenChange={onOpenChange}
        >
            <Dialog.Portal>
                <Dialog.Overlay className='fixed inset-0 z-50 bg-[rgba(0,0,0,0.6)] animate-fade' />
                <div className='pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-6'>
                    <Dialog.Content className='pointer-events-auto max-h-[92vh] w-full max-w-[480px] overflow-y-auto border border-line-2 bg-canvas p-[22px] animate-slideup focus:outline-none md:animate-pop'>
                        <div className='mb-1 flex items-start justify-between gap-3'>
                            <div>
                                <Dialog.Title className='text-[22px] font-extrabold tracking-[-0.02em]'>
                                    {title}
                                </Dialog.Title>
                                {description ?
                                    <Dialog.Description className='mt-1.5 text-body-sm leading-[1.5] text-ink-2'>
                                        {description}
                                    </Dialog.Description>
                                :   null}
                            </div>
                            <IconButton
                                asChild
                                size='sm'
                            >
                                <Dialog.Close aria-label='Close'>
                                    <IconX size={18} />
                                </Dialog.Close>
                            </IconButton>
                        </div>

                        {children}

                        {footer ?
                            <div className='mt-[22px] flex justify-end gap-2.5'>
                                {footer}
                            </div>
                        :   null}
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
