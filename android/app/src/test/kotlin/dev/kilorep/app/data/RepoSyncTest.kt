package dev.kilorep.app.data

import dev.kilorep.api.models.Exercise
import dev.kilorep.api.models.PrescribedSet
import dev.kilorep.api.models.SessionEntry
import dev.kilorep.api.models.SessionExercise
import dev.kilorep.api.models.SessionWithEntries
import dev.kilorep.app.ui.screens.FakeSettings
import java.nio.file.Files
import java.time.OffsetDateTime
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest

private fun session() = SessionWithEntries(
    id = 7,
    userId = 1,
    name = "Push Day",
    position = 0,
    createdAt = OffsetDateTime.parse("2026-06-01T10:00:00Z"),
    entries = listOf(
        SessionEntry(
            id = 10,
            sessionId = 7,
            position = 0,
            exercises = listOf(
                SessionExercise(
                    id = 21,
                    entryId = 10,
                    exerciseId = 2,
                    position = 0,
                    exercise = Exercise(
                        id = 2,
                        userId = 1,
                        name = "Bench Press",
                        equipment = Exercise.Equipment.barbell,
                        type = Exercise.Type.compound,
                        muscles = emptyList(),
                        aliases = emptyList(),
                    ),
                    sets = listOf(
                        PrescribedSet(id = 30, sessionExerciseId = 21, reps = 8, position = 0),
                    ),
                ),
            ),
        ),
    ),
)

private fun json(body: String) =
    MockResponse().setBody(body).setHeader("Content-Type", "application/json")

private const val WORKOUT_55 =
    """{"id":55,"userId":1,"sessionId":7,"name":"Push Day",
       "startedAt":"2026-06-12T18:00:00Z","completed":false}"""

/**
 * Repo-level sync races (the PRD's "never drop a logged set" invariant):
 * real Repo against a temp dir and a scripted MockWebServer whose dispatcher
 * can hold responses, so the test controls what happens mid-flight.
 */
class RepoSyncTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: Repo

    @BeforeTest
    fun setUp() {
        server = MockWebServer()
        server.start()
        repo = Repo(
            backend = Backend(
                FakeSettings(serverUrl = server.url("/").toString().trimEnd('/')),
                onAuthRejected = {},
            ),
            files = JsonStore(Files.createTempDirectory("kilorep-test").toFile()),
            onDirtyDrafts = {},
        )
    }

    @AfterTest
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `a mid-flight edit survives the sync outcome and replays next`() = runBlocking {
        val requests = CopyOnWriteArrayList<String>()
        val putBodies = CopyOnWriteArrayList<String>()
        val putReceived = CountDownLatch(1)
        val editApplied = CountDownLatch(1)
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                requests += "${request.method} ${request.path}"
                return when (request.method) {
                    "POST" -> json(WORKOUT_55)
                    "PUT" -> {
                        putBodies += request.body.readUtf8()
                        putReceived.countDown()
                        // Hold the response so the test can edit while the
                        // replay is in flight.
                        editApplied.await(5, TimeUnit.SECONDS)
                        json(WORKOUT_55)
                    }
                    else -> json("[]")
                }
            }
        }

        val draft = repo.startWorkout(session())
        repo.updateDraft(
            repo.draft(draft.localId)!!.updateSet(0, 0, 0) { it.copy(weight = 60.0) },
        )

        val firstSync = async(Dispatchers.Default) { repo.syncNow() }
        assertTrue(putReceived.await(5, TimeUnit.SECONDS), "replay never reached the PUT")
        // The lifter keeps logging while the snapshot is on the wire.
        repo.updateDraft(
            repo.draft(draft.localId)!!.updateSet(0, 0, 0) { it.copy(weight = 80.0) },
        )
        editApplied.countDown()

        assertTrue(firstSync.await(), "dirty work must remain so the worker retries")
        val after = repo.draft(draft.localId)
        assertNotNull(after, "the edited draft must not be discarded")
        assertTrue(after.dirty, "the mid-flight edit must stay queued for replay")
        assertEquals(55, after.serverId, "the created identity must be recorded")
        assertEquals(80.0, after.entries[0].exercises[0].sets[0].weight)

        // The next replay PUTs the newer tree against the recorded id — it
        // must not create a duplicate workout.
        repo.syncNow()

        assertEquals(1, requests.count { it.startsWith("POST /api/workouts") })
        assertEquals(2, putBodies.size)
        assertTrue(putBodies[1].contains("\"weight\":80.0"))
        val settled = repo.draft(draft.localId)
        assertNotNull(settled)
        assertFalse(settled.dirty)
    }

    @Test
    fun `an unedited draft keeps today's terminal behavior`() = runBlocking {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = when (request.method) {
                "POST" -> json(WORKOUT_55)
                "PUT" -> json(WORKOUT_55)
                else -> json("[]")
            }
        }

        val draft = repo.startWorkout(session())
        repo.updateDraft(repo.draft(draft.localId)!!.finish())

        val remains = repo.syncNow()

        assertFalse(remains)
        assertEquals(null, repo.draft(draft.localId), "a synced completed draft is discarded")
    }
}
