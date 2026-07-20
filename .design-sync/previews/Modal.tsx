import { Button, Modal } from '@kilorep/lift-react'

export function Confirm() {
    return (
        <Modal
            open
            title='Delete session?'
            description='This removes all 6 exercises and their logged sets. It cannot be undone.'
            footer={
                <>
                    <Button tone='ghost'>Cancel</Button>
                    <Button tone='danger'>Delete</Button>
                </>
            }
        />
    )
}
