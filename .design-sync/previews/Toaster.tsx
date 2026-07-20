import { Toaster } from '@kilorep/lift-react'

// The queue is a prop in the mirror (the Vue reads it from useToast()).
//
// The viewport is `position: fixed` bottom-right, and the capture harness puts
// a `transform: translateZ(0)` on the cell wrapper, which makes that wrapper the
// containing block for fixed children. Without an explicit height the wrapper
// collapses to zero and the stack lands above the top of the frame, so each cell
// supplies a page-sized stage for the overlay to sit in.

const stage = { height: 560, width: '100%' }

export function Colors() {
    return (
        <div style={stage}>
            <Toaster
                toasts={[
                    {
                        id: 'saved',
                        color: 'success',
                        title: 'Session saved',
                        description: '5 exercises logged',
                    },
                    {
                        id: 'failed',
                        color: 'error',
                        title: 'Could not save the workout',
                        description: 'Check your connection',
                    },
                    {
                        id: 'draft',
                        color: 'neutral',
                        title: 'Draft kept',
                        description: 'Push day resumes where you left off',
                    },
                ]}
            />
        </div>
    )
}

export function TitleOnly() {
    return (
        <div style={stage}>
            <Toaster
                toasts={[
                    {
                        id: 'finished',
                        color: 'success',
                        title: 'Workout finished',
                    },
                    {
                        id: 'deleted',
                        color: 'neutral',
                        title: 'Exercise deleted',
                    },
                ]}
            />
        </div>
    )
}

export function SingleError() {
    return (
        <div style={stage}>
            <Toaster
                toasts={[
                    {
                        id: 'load',
                        color: 'error',
                        title: 'Could not load sessions',
                        description:
                            'Retry in a moment (your logged sets are safe)',
                    },
                ]}
            />
        </div>
    )
}
