import { Card, CardHead, PlanBlock, PlanExercise } from '@kilorep/lift-react'

// Mirrors the plan readout on /workouts and /sessions: one PlanBlock per
// session entry, numbered 01..N across the whole session (superset members
// included), targets in the "3 × 8" / "3 sets" / "4 sets · 82.5 kg" shapes
// setSummary and exSummary actually produce.

export function Plain() {
    return (
        <Card style={{ maxWidth: 420 }}>
            <PlanBlock>
                <PlanExercise
                    index='01'
                    name='Barbell Bench Press'
                    target='4 × 6'
                />
            </PlanBlock>
            <PlanBlock>
                <PlanExercise
                    index='02'
                    name='Incline Dumbbell Press'
                    target='3 × 10'
                />
            </PlanBlock>
            <PlanBlock>
                <PlanExercise
                    index='03'
                    name='Overhead Press'
                    target='3 × 8'
                />
            </PlanBlock>
        </Card>
    )
}

export function Superset() {
    return (
        <Card style={{ maxWidth: 420 }}>
            <PlanBlock>
                <PlanExercise
                    index='01'
                    name='Back Squat'
                    target='5 × 5'
                />
            </PlanBlock>
            <PlanBlock superset>
                <PlanExercise
                    index='02'
                    name='Leg Extension'
                    target='3 × 12'
                />
                <PlanExercise
                    index='03'
                    name='Seated Leg Curl'
                    target='3 × 12'
                />
            </PlanBlock>
            <PlanBlock>
                <PlanExercise
                    index='04'
                    name='Standing Calf Raise'
                    target='4 × 15'
                />
            </PlanBlock>
        </Card>
    )
}

export function SessionCard() {
    return (
        <Card style={{ maxWidth: 440 }}>
            <CardHead>
                <div>
                    <h3 className='text-body-lg font-semibold'>Push A</h3>
                    <p className='mono text-label text-ink-2'>
                        5 exercises · 17 sets · 8,240 kg
                    </p>
                </div>
            </CardHead>
            <div style={{ marginTop: 10 }}>
                <PlanBlock>
                    <PlanExercise
                        index='01'
                        to='/exercises/barbell-bench-press'
                        name='Barbell Bench Press'
                        target='4 sets · 82.5 kg'
                    />
                </PlanBlock>
                <PlanBlock>
                    <PlanExercise
                        index='02'
                        to='/exercises/incline-dumbbell-press'
                        name='Incline Dumbbell Press'
                        target='3 sets · 30 kg'
                    />
                </PlanBlock>
                <PlanBlock superset>
                    <PlanExercise
                        index='03'
                        to='/exercises/cable-fly'
                        name='Cable Fly'
                        target='3 × 12'
                    />
                    <PlanExercise
                        index='04'
                        to='/exercises/cable-triceps-pushdown'
                        name='Cable Triceps Pushdown'
                        target='3 × 12'
                    />
                </PlanBlock>
                <PlanBlock>
                    <PlanExercise
                        index='05'
                        to='/exercises/lateral-raise'
                        name='Dumbbell Lateral Raise'
                        target='12, 10, 8'
                    />
                </PlanBlock>
            </div>
        </Card>
    )
}
