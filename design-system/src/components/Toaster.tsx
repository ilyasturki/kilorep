import { tv } from 'tailwind-variants'
import * as Toast from '@radix-ui/react-toast'

// The left edge carries the status colour; tv() resolves it against the base
// border-l-ink-3 so the two never both apply.
//
// The swipe transform reads reka's `--reka-toast-swipe-move-x` in the Vue
// original; Radix publishes the same value as `--radix-toast-swipe-move-x`.
const toast = tv({
    base: 'flex items-center gap-[11px] border border-line-2 border-l-[3px] border-l-ink-3 bg-surface px-[15px] py-[13px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] data-[state=open]:animate-slidein data-[state=closed]:animate-fadeout data-[swipe=end]:animate-fadeout data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
    variants: {
        color: {
            success: 'border-l-accent',
            error: 'border-l-red',
            neutral: '',
        },
    },
})

export type ToastItem = {
    id: string | number
    title: string
    description?: string
    color?: 'success' | 'error' | 'neutral'
}

/**
 * Bottom-right toast stack. The Vue original pulls its queue from the app's
 * `useToast()` composable; here the queue is passed in, which is the form a
 * design can actually render.
 */
export interface ToasterProps {
    toasts: readonly ToastItem[]
    onDismiss?: (id: string | number) => void
}

export function Toaster({ toasts, onDismiss }: ToasterProps) {
    return (
        <Toast.Provider
            duration={3500}
            swipeDirection='right'
        >
            {toasts.map((t) => (
                <Toast.Root
                    key={t.id}
                    className={toast({ color: t.color })}
                    onOpenChange={(open) => !open && onDismiss?.(t.id)}
                >
                    <div>
                        <Toast.Title className='text-body font-semibold text-ink'>
                            {t.title}
                        </Toast.Title>
                        {t.description ?
                            <Toast.Description className='mt-0.5 text-[12.5px] leading-[1.45] text-ink-2'>
                                {t.description}
                            </Toast.Description>
                        :   null}
                    </div>
                </Toast.Root>
            ))}
            <Toast.Viewport className='fixed right-0 bottom-0 z-[80] m-0 flex w-[380px] max-w-[100vw] list-none flex-col gap-2.5 p-[18px] outline-none' />
        </Toast.Provider>
    )
}
