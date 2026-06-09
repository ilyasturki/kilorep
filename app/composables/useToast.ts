export type ToastColor = 'success' | 'error' | 'neutral'

export interface ToastItem {
    id: number
    title: string
    description?: string
    color: ToastColor
}

let seq = 0

export function useToast() {
    const toasts = useState<ToastItem[]>('ui-toasts', () => [])

    function add(toast: {
        title: string
        description?: string
        color?: ToastColor
    }) {
        toasts.value = [
            ...toasts.value,
            {
                id: ++seq,
                color: toast.color ?? 'neutral',
                title: toast.title,
                description: toast.description,
            },
        ]
    }

    function remove(id: number) {
        toasts.value = toasts.value.filter((t) => t.id !== id)
    }

    return { toasts, add, remove }
}
