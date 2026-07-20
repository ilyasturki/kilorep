import { Empty } from '@kilorep/lift-react'

export function NoSessions() {
    return <Empty>No sessions yet. Create your first routine.</Empty>
}

export function NoWeighIns() {
    return (
        <Empty>
            No weigh-ins yet. Log your first to start tracking progression.
        </Empty>
    )
}

export function WithLink() {
    return (
        <Empty>
            No templates yet.{' '}
            <a
                href='#'
                className='text-accent-ink'
            >
                Create a session
            </a>{' '}
            first.
        </Empty>
    )
}

export function Loading() {
    return <Empty>Loading…</Empty>
}
