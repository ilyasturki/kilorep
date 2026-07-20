import { Card, PlanBlock, PlanExercise } from '@kilorep/lift-react'

// PlanExercise only ever appears inside a PlanBlock (see /workouts, /sessions
// and the review view of /workouts/[id]), so every card composes the two.
// Targets use the shapes setSummary and exSummary actually produce: "3 × 8"
// when every set shares a rep target, "3 sets" when none does, the per-set reps
// otherwise, and "4 sets · 82.5 kg" once a top weight is logged.

export function Rows() {
    return (
        <Card style={{ maxWidth: 420 }}>
            <PlanBlock>
                <PlanExercise
                    index='01'
                    name='Deadlift'
                    target='4 × 5'
                />
            </PlanBlock>
            <PlanBlock>
                <PlanExercise
                    index='02'
                    name='Lat Pulldown'
                    target='12, 10, 8'
                />
            </PlanBlock>
            <PlanBlock>
                <PlanExercise
                    index='03'
                    name='Barbell Row'
                    target='3 sets'
                />
            </PlanBlock>
            <PlanBlock>
                <PlanExercise
                    index='04'
                    name='Hammer Curl'
                    target='3 sets · 14 kg'
                />
            </PlanBlock>
        </Card>
    )
}

export function Linked() {
    // Identical chrome to Rows by design: `to` only tints the name on hover,
    // so the dense list stays free of link decoration.
    return (
        <Card style={{ maxWidth: 420 }}>
            <PlanBlock>
                <PlanExercise
                    index='01'
                    to='/exercises/back-squat'
                    name='Back Squat'
                    target='5 sets · 110 kg'
                />
            </PlanBlock>
            <PlanBlock>
                <PlanExercise
                    index='02'
                    to='/exercises/romanian-deadlift'
                    name='Romanian Deadlift'
                    target='3 sets · 90 kg'
                />
            </PlanBlock>
            <PlanBlock>
                <PlanExercise
                    index='03'
                    to='/exercises/bulgarian-split-squat'
                    name='Bulgarian Split Squat'
                    target='3 × 10'
                />
            </PlanBlock>
        </Card>
    )
}

export function SupersetGroup() {
    return (
        <Card style={{ maxWidth: 420 }}>
            <PlanBlock>
                <PlanExercise
                    index='01'
                    to='/exercises/preacher-curl'
                    name='Preacher Curl'
                    target='3 × 10'
                />
            </PlanBlock>
            <PlanBlock superset>
                <PlanExercise
                    index='02'
                    to='/exercises/hammer-curl'
                    name='Hammer Curl'
                    target='3 × 12'
                />
                <PlanExercise
                    index='03'
                    to='/exercises/skull-crusher'
                    name='Skull Crusher'
                    target='3 × 12'
                />
            </PlanBlock>
        </Card>
    )
}
