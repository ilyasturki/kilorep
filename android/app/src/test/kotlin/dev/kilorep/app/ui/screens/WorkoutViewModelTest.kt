package dev.kilorep.app.ui.screens

import dev.kilorep.api.models.Exercise
import dev.kilorep.api.models.PrescribedSet
import dev.kilorep.api.models.SessionEntry
import dev.kilorep.api.models.SessionExercise
import dev.kilorep.api.models.SessionWithEntries
import dev.kilorep.app.data.Backend
import dev.kilorep.app.data.JsonStore
import dev.kilorep.app.data.Repo
import java.nio.file.Files
import java.time.OffsetDateTime
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer

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

/**
 * ViewModel-level tests (the PRD's UI testing scope): the gym loop drives a
 * real Repo persisting to a temp dir, and sync replays against a scripted
 * MockWebServer — the real generated client, real HTTP, no Android.
 */
class WorkoutViewModelTest {

    private val dispatcher = UnconfinedTestDispatcher()
    private lateinit var server: MockWebServer
    private lateinit var repo: Repo
    private var dirtyKicks = 0

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        server = MockWebServer()
        server.start()
        repo = Repo(
            backend = Backend(
                FakeSettings(serverUrl = server.url("/").toString().trimEnd('/')),
                onAuthRejected = {},
            ),
            files = JsonStore(Files.createTempDirectory("kilorep-test").toFile()),
            onDirtyDrafts = { dirtyKicks++ },
        )
    }

    @AfterTest
    fun tearDown() {
        server.shutdown()
        Dispatchers.resetMain()
    }

    private fun startedViewModel(): WorkoutViewModel {
        val draft = repo.startWorkout(session())
        return WorkoutViewModel(repo, draft.localId)
    }

    @Test
    fun `ticking a set persists and schedules background sync`() {
        val vm = startedViewModel()
        dirtyKicks = 0

        vm.toggleDone(0, 0, 0)

        val draft = vm.draft.value
        assertNotNull(draft)
        assertTrue(draft.entries[0].exercises[0].sets[0].done)
        assertTrue(draft.dirty)
        assertTrue(dirtyKicks > 0, "a dirty draft must schedule the sync worker")
    }

    @Test
    fun `weight steps by plate increments and never goes negative`() {
        val vm = startedViewModel()

        vm.stepWeight(0, 0, 0, +1)
        vm.stepWeight(0, 0, 0, +1)
        assertEquals(5.0, vm.draft.value?.entries?.get(0)?.exercises?.get(0)?.sets?.get(0)?.weight)

        vm.stepWeight(0, 0, 0, -1)
        vm.stepWeight(0, 0, 0, -1)
        vm.stepWeight(0, 0, 0, -1)
        assertNull(vm.draft.value?.entries?.get(0)?.exercises?.get(0)?.sets?.get(0)?.weight)
    }

    @Test
    fun `finish replays create-then-put and the draft leaves the queue`() {
        val vm = startedViewModel()
        vm.setWeight(0, 0, 0, 80.0)
        vm.toggleDone(0, 0, 0)

        // POST /api/workouts (create from session) → PUT /api/workouts/55 →
        // GET /api/workouts (history refresh after a successful sync).
        server.enqueue(
            MockResponse().setBody(
                """{"id":55,"userId":1,"sessionId":7,"name":"Push Day",
                   "startedAt":"2026-06-12T18:00:00Z","completed":false}""",
            ).setHeader("Content-Type", "application/json"),
        )
        server.enqueue(
            MockResponse().setBody(
                """{"id":55,"userId":1,"sessionId":7,"name":"Push Day",
                   "startedAt":"2026-06-12T18:00:00Z","completed":true,
                   "template":{"id":7,"name":"Push Day","diverged":false}}""",
            ).setHeader("Content-Type", "application/json"),
        )
        server.enqueue(
            MockResponse().setBody("[]").setHeader("Content-Type", "application/json"),
        )

        vm.finish()

        val create = server.takeRequest(5, java.util.concurrent.TimeUnit.SECONDS)!!
        assertEquals("POST", create.method)
        assertEquals("/api/workouts", create.path)
        assertTrue(create.body.readUtf8().contains("\"sessionId\":7"))

        val put = server.takeRequest(5, java.util.concurrent.TimeUnit.SECONDS)!!
        assertEquals("PUT", put.method)
        assertEquals("/api/workouts/55", put.path)
        val payload = put.body.readUtf8()
        assertTrue(payload.contains("\"completed\":true"))
        assertTrue(payload.contains("\"weight\":80.0"))
        assertTrue(payload.contains("\"done\":true"))

        // Synced + completed → the draft is gone; history owns it now.
        awaitUntil("draft leaves the queue") { vm.draft.value == null }
    }

    @Test
    fun `failed sync keeps the draft and surfaces the error`() {
        val vm = startedViewModel()
        vm.setWeight(0, 0, 0, 60.0)

        server.enqueue(MockResponse().setResponseCode(404).setBody("""{"message":"Session not found"}"""))

        vm.finish()

        awaitUntil("sync error surfaces") {
            vm.syncStatus.value is dev.kilorep.app.data.SyncStatus.Error
        }
        val draft = vm.draft.value
        assertNotNull(draft, "an unsynced workout must never be dropped")
        assertTrue(draft.dirty)
    }

    @Test
    fun `bearer token rides along when configured`() = kotlinx.coroutines.runBlocking {
        val settings = FakeSettings(
            serverUrl = server.url("/").toString().trimEnd('/'),
            authEnabled = true,
            deviceToken = "kr_test-token",
        )
        var rejected = false
        val authedRepo = Repo(
            backend = Backend(settings, onAuthRejected = { rejected = true }),
            files = JsonStore(Files.createTempDirectory("kilorep-test").toFile()),
            onDirtyDrafts = {},
        )
        server.enqueue(MockResponse().setBody("[]").setHeader("Content-Type", "application/json"))

        authedRepo.refreshSessions()

        assertEquals("Bearer kr_test-token", server.takeRequest().getHeader("Authorization"))
        assertFalse(rejected)
    }

    @Test
    fun `a 401 with a token means revoked — credential is dropped`() = kotlinx.coroutines.runBlocking {
        val settings = FakeSettings(
            serverUrl = server.url("/").toString().trimEnd('/'),
            authEnabled = true,
            deviceToken = "kr_revoked",
        )
        var rejected = false
        val authedRepo = Repo(
            backend = Backend(settings, onAuthRejected = { rejected = true }),
            files = JsonStore(Files.createTempDirectory("kilorep-test").toFile()),
            onDirtyDrafts = {},
        )
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setBody("""{"message":"Invalid token"}""")
                .setHeader("Content-Type", "application/json"),
        )

        authedRepo.refreshSessions()

        assertTrue(rejected)
    }

    @Test
    fun `a captive portal 401 does not destroy the credential`() = kotlinx.coroutines.runBlocking {
        val settings = FakeSettings(
            serverUrl = server.url("/").toString().trimEnd('/'),
            authEnabled = true,
            deviceToken = "kr_valid",
        )
        var rejected = false
        val authedRepo = Repo(
            backend = Backend(settings, onAuthRejected = { rejected = true }),
            files = JsonStore(Files.createTempDirectory("kilorep-test").toFile()),
            onDirtyDrafts = {},
        )
        // Portals and reverse proxies answer 401 in HTML; only kilorep's own
        // JSON errors mean the device token was actually revoked.
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setBody("<html><body>Hotel Wi-Fi login</body></html>")
                .setHeader("Content-Type", "text/html"),
        )

        authedRepo.refreshSessions()

        assertFalse(rejected, "an HTML 401 must not be treated as revocation")
    }
}
