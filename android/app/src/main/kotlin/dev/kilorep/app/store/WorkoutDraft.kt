package dev.kilorep.app.store

import dev.kilorep.api.models.LoggedSetInput
import dev.kilorep.api.models.SessionWithEntries
import dev.kilorep.api.models.WorkoutDetail
import dev.kilorep.api.models.WorkoutEntryInput
import dev.kilorep.api.models.WorkoutExerciseInput
import dev.kilorep.api.models.WorkoutInput
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

/**
 * The active workout as it lives on-device. A draft
 * is the lifter's single source of truth from start to sync: built locally
 * from a cached session so a dead zone never blocks starting, persisted on
 * every mutation so process death never loses a set, and replayed to the
 * server at workout granularity when connectivity allows (create-then-PUT,
 * last writer wins).
 *
 * Pure Kotlin — no Android imports — so the whole gym loop's state logic is
 * testable as plain JVM unit tests.
 */
data class DraftSet(
    val reps: Int?,
    val weight: Double?,
    val done: Boolean,
    /** The prescribed rep target, shown beside what's being logged. */
    val target: Int?,
) {
    /**
     * Web has no separate "done" step — typing the load and reps logs the set.
     * Mirror that: once a set has both, it counts as performed. Only flips
     * false→true, so the tick stays user-overridable and clearing a field on
     * an already-ticked set never silently un-ticks it.
     */
    fun autoDone(): DraftSet =
        if (reps != null && weight != null && !done) copy(done = true) else this
}

data class DraftExercise(
    val exerciseId: Int,
    /** Denormalized so offline rendering never needs the catalog cache. */
    val name: String,
    val sets: List<DraftSet>,
)

/** One entry; several exercises means a superset in rotation order. */
data class DraftEntry(
    val exercises: List<DraftExercise>,
    /**
     * UI list identity (entries have no server id while offline). Defaulted
     * so drafts persisted before this field existed still deserialize —
     * Moshi's reflective adapter falls back to constructor defaults.
     */
    val id: String = UUID.randomUUID().toString(),
)

data class WorkoutDraft(
    /** On-device identity; stable across process death and sync retries. */
    val localId: String,
    /** Set once the workout exists server-side; null while offline-only. */
    val serverId: Int?,
    /** The session this was started from; replay creates through it. */
    val sessionId: Int?,
    val name: String,
    /** ISO-8601 with offset. */
    val startedAt: String,
    val completed: Boolean,
    /** True whenever the local tree is ahead of the server. */
    val dirty: Boolean,
    val entries: List<DraftEntry>,
) {
    val isSyncable: Boolean
        get() = entries.any { entry ->
            entry.exercises.any { it.sets.isNotEmpty() }
        }

    /**
     * The whole-tree replay payload. Entries that lost all their exercises
     * are dropped — the server refuses empty ones — but set slots survive
     * untouched, nulls included, mirroring the web's autosave semantics.
     */
    fun toInput(): WorkoutInput = WorkoutInput(
        entries = entries
            .map { entry ->
                WorkoutEntryInput(
                    exercises = entry.exercises
                        .filter { it.sets.isNotEmpty() }
                        .map { exercise ->
                            WorkoutExerciseInput(
                                exerciseId = exercise.exerciseId,
                                sets = exercise.sets.map { set ->
                                    LoggedSetInput(
                                        reps = set.reps,
                                        weight = set.weight,
                                        done = set.done,
                                    )
                                },
                            )
                        },
                )
            }
            .filter { it.exercises.isNotEmpty() },
        name = name,
        completed = completed,
        startedAt = OffsetDateTime.parse(startedAt),
    )

    // ── Gym-loop mutations: every one returns a dirty copy to persist ──────

    fun updateSet(
        entryIndex: Int,
        exerciseIndex: Int,
        setIndex: Int,
        transform: (DraftSet) -> DraftSet,
    ): WorkoutDraft = mapExercise(entryIndex, exerciseIndex) { exercise ->
        exercise.copy(
            sets = exercise.sets.mapIndexed { i, set ->
                if (i == setIndex) transform(set) else set
            },
        )
    }

    /** A new set seeds from the previous one — the likeliest next effort. */
    fun addSet(entryIndex: Int, exerciseIndex: Int): WorkoutDraft =
        mapExercise(entryIndex, exerciseIndex) { exercise ->
            val last = exercise.sets.lastOrNull()
            exercise.copy(
                // Carrying a full set forward means it already has load+reps, so
                // it lands done — matching web, where an added set defaults done.
                sets = exercise.sets + DraftSet(
                    reps = last?.reps,
                    weight = last?.weight,
                    done = false,
                    target = last?.target,
                ).autoDone(),
            )
        }

    fun removeSet(entryIndex: Int, exerciseIndex: Int, setIndex: Int): WorkoutDraft =
        mapExercise(entryIndex, exerciseIndex) { exercise ->
            exercise.copy(sets = exercise.sets.filterIndexed { i, _ -> i != setIndex })
        }
            .pruneEmpty()

    /**
     * Swaps the movement, keeping the logged sets — the use case is an
     * occupied machine, where the planned volume still stands.
     */
    fun swapExercise(
        entryIndex: Int,
        exerciseIndex: Int,
        exerciseId: Int,
        name: String,
    ): WorkoutDraft = mapExercise(entryIndex, exerciseIndex) {
        it.copy(exerciseId = exerciseId, name = name)
    }

    /** Appends a plain-exercise entry with one open set. */
    fun addExercise(exerciseId: Int, name: String): WorkoutDraft = copy(
        dirty = true,
        entries = entries + DraftEntry(
            exercises = listOf(
                DraftExercise(
                    exerciseId = exerciseId,
                    name = name,
                    sets = listOf(DraftSet(reps = null, weight = null, done = false, target = null)),
                ),
            ),
        ),
    )

    fun removeExercise(entryIndex: Int, exerciseIndex: Int): WorkoutDraft = copy(
        dirty = true,
        entries = entries.mapIndexed { i, entry ->
            if (i != entryIndex) {
                entry
            } else {
                entry.copy(
                    exercises = entry.exercises.filterIndexed { j, _ -> j != exerciseIndex },
                )
            }
        },
    ).pruneEmpty()

    /**
     * Reorders a whole entry; a plain exercise or a superset block moves as a
     * unit, mirroring web's up/down controls. Out-of-range moves are no-ops.
     */
    fun moveEntry(from: Int, to: Int): WorkoutDraft {
        if (from !in entries.indices || to !in entries.indices || from == to) return this
        val reordered = entries.toMutableList().apply { add(to, removeAt(from)) }
        return copy(entries = reordered, dirty = true)
    }

    /**
     * Moves the workout to another calendar day, keeping the original
     * time-of-day so same-day ordering stays stable (matches web).
     */
    fun withDay(day: LocalDate): WorkoutDraft =
        copy(startedAt = OffsetDateTime.parse(startedAt).with(day).toString(), dirty = true)

    fun finish(): WorkoutDraft = copy(completed = true, dirty = true)

    private fun mapExercise(
        entryIndex: Int,
        exerciseIndex: Int,
        transform: (DraftExercise) -> DraftExercise,
    ): WorkoutDraft = copy(
        dirty = true,
        entries = entries.mapIndexed { i, entry ->
            if (i != entryIndex) {
                entry
            } else {
                entry.copy(
                    exercises = entry.exercises.mapIndexed { j, exercise ->
                        if (j == exerciseIndex) transform(exercise) else exercise
                    },
                )
            }
        },
    )

    private fun pruneEmpty(): WorkoutDraft = copy(
        entries = entries.filter { entry ->
            entry.exercises.any { it.sets.isNotEmpty() }
        }.map { entry ->
            entry.copy(exercises = entry.exercises.filter { it.sets.isNotEmpty() })
        },
    )

    companion object {
        /**
         * Builds the draft locally from a cached session tree — the same
         * copy-on-start semantics as the server's, so offline and online
         * starts produce the same workout. Prescribed reps seed each set's
         * reps and stay visible as the target.
         */
        fun fromSession(
            session: SessionWithEntries,
            localId: String,
            startedAt: String,
        ): WorkoutDraft = WorkoutDraft(
            localId = localId,
            serverId = null,
            sessionId = session.id,
            name = session.name,
            startedAt = startedAt,
            completed = false,
            dirty = true,
            entries = session.entries
                .sortedBy { it.position }
                .map { entry ->
                    DraftEntry(
                        exercises = entry.exercises
                            .sortedBy { it.position }
                            .map { exercise ->
                                DraftExercise(
                                    exerciseId = exercise.exerciseId,
                                    name = exercise.exercise.name,
                                    sets = exercise.sets
                                        .sortedBy { it.position }
                                        .map { set ->
                                            DraftSet(
                                                reps = set.reps,
                                                weight = null,
                                                done = false,
                                                target = set.reps,
                                            )
                                        },
                                )
                            },
                    )
                },
        )

        /** Reopens a server workout for editing through the same loop. */
        fun fromWorkout(detail: WorkoutDetail, localId: String): WorkoutDraft =
            WorkoutDraft(
                localId = localId,
                serverId = detail.id,
                sessionId = detail.sessionId,
                name = detail.name,
                startedAt = detail.startedAt.toString(),
                completed = detail.completed,
                dirty = false,
                entries = detail.entries
                    .sortedBy { it.position }
                    .map { entry ->
                        DraftEntry(
                            exercises = entry.exercises
                                .sortedBy { it.position }
                                .map { exercise ->
                                    DraftExercise(
                                        exerciseId = exercise.exerciseId,
                                        name = exercise.exercise.name,
                                        sets = exercise.sets
                                            .sortedBy { it.position }
                                            .map { set ->
                                                DraftSet(
                                                    reps = set.reps,
                                                    weight = set.weight,
                                                    done = set.done,
                                                    target = null,
                                                )
                                            },
                                    )
                                },
                        )
                    },
            )
    }
}
