package dev.kilorep.app.ui.screens

import dev.kilorep.app.data.Backend
import dev.kilorep.app.data.JsonStore
import dev.kilorep.app.data.Repo
import java.nio.file.Files
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer

class SessionEditorViewModelTest {

    private val dispatcher = UnconfinedTestDispatcher()
    private lateinit var server: MockWebServer
    private lateinit var repo: Repo

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
            onDirtyDrafts = {},
        )
    }

    @AfterTest
    fun tearDown() {
        server.shutdown()
        Dispatchers.resetMain()
    }

    @Test
    fun `a session needs a name and one exercise with one set`() {
        val vm = SessionEditorViewModel(repo, sessionId = null)
        assertFalse(vm.canSave)

        vm.setName("Push Day")
        assertFalse(vm.canSave)

        vm.addEntry(2, "Bench Press")
        assertTrue(vm.canSave)

        vm.removeSet(0, 0, 0)
        assertFalse(vm.canSave, "an exercise without sets is not programmable")
    }

    @Test
    fun `removing the last set removes the exercise, and the entry when emptied`() {
        val vm = SessionEditorViewModel(repo, sessionId = null)
        vm.setName("Push Day")
        vm.addEntry(2, "Bench Press")
        vm.addToEntry(0, 4, "Fly")

        vm.removeSet(0, 1, 0)
        assertEquals(
            listOf("Bench Press"),
            vm.entries.value[0].exercises.map { it.name },
            "a set-less exercise would be dropped by the server; drop it in the editor too",
        )

        vm.removeSet(0, 0, 0)
        assertTrue(vm.entries.value.isEmpty(), "an entry with no exercises left goes with them")
    }

    @Test
    fun `save sends no empty-sets exercises`() {
        val vm = SessionEditorViewModel(repo, sessionId = null)
        vm.setName("Push Day")
        vm.addEntry(2, "Bench Press")
        vm.setReps(0, 0, 0, 8)
        vm.addToEntry(0, 4, "Fly")
        vm.removeSet(0, 1, 0)

        server.enqueue(
            MockResponse().setBody(
                """{"id":9,"userId":1,"name":"Push Day","position":-1,
                   "createdAt":"2026-06-12T10:00:00Z"}""",
            ).setHeader("Content-Type", "application/json"),
        )
        server.enqueue(MockResponse().setBody("[]").setHeader("Content-Type", "application/json"))

        vm.save()

        val request = server.takeRequest(5, java.util.concurrent.TimeUnit.SECONDS)!!
        val body = request.body.readUtf8()
        assertTrue(body.contains("\"exerciseId\":2"), "the kept exercise still saves: $body")
        assertFalse(body.contains("\"exerciseId\":4"), "the emptied exercise must not be sent: $body")
        assertFalse(body.contains("\"sets\":[]"), "no exercise may arrive set-less: $body")
        awaitUntil("editor reports saved") { vm.saved.value }
    }

    @Test
    fun `adding into an entry builds a superset in rotation order`() {
        val vm = SessionEditorViewModel(repo, sessionId = null)
        vm.setName("Pull Day")
        vm.addEntry(3, "Row")
        vm.addToEntry(0, 4, "Curl")

        assertEquals(listOf("Row", "Curl"), vm.entries.value[0].exercises.map { it.name })

        vm.moveExercise(0, 1, -1)
        assertEquals(listOf("Curl", "Row"), vm.entries.value[0].exercises.map { it.name })
    }

    @Test
    fun `entries reorder with explicit moves`() {
        val vm = SessionEditorViewModel(repo, sessionId = null)
        vm.setName("Legs")
        vm.addEntry(5, "Squat")
        vm.addEntry(6, "Leg Curl")

        vm.moveEntry(1, -1)
        assertEquals(
            listOf("Leg Curl", "Squat"),
            vm.entries.value.map { it.exercises[0].name },
        )
        // Out-of-range moves are ignored, not crashes.
        vm.moveEntry(0, -1)
        assertEquals("Leg Curl", vm.entries.value[0].exercises[0].name)
    }

    @Test
    fun `save posts the whole tree with open targets kept`() {
        val vm = SessionEditorViewModel(repo, sessionId = null)
        vm.setName("Push Day")
        vm.addEntry(2, "Bench Press")
        vm.setReps(0, 0, 0, 8)
        vm.addSet(0, 0)
        vm.setReps(0, 0, 1, null)

        server.enqueue(
            MockResponse().setBody(
                """{"id":9,"userId":1,"name":"Push Day","position":-1,
                   "createdAt":"2026-06-12T10:00:00Z"}""",
            ).setHeader("Content-Type", "application/json"),
        )
        // The refresh after a successful save.
        server.enqueue(MockResponse().setBody("[]").setHeader("Content-Type", "application/json"))

        vm.save()

        val request = server.takeRequest(5, java.util.concurrent.TimeUnit.SECONDS)!!
        assertEquals("POST", request.method)
        assertEquals("/api/sessions", request.path)
        val body = request.body.readUtf8()
        assertTrue(body.contains("\"name\":\"Push Day\""))
        // Moshi omits nulls: an open target serializes as an empty set slot,
        // which the server's parser reads as exactly that — an open target.
        assertTrue(
            body.contains("\"sets\":[{\"reps\":8},{}]"),
            "the open-target set keeps its slot: $body",
        )
        awaitUntil("editor reports saved") { vm.saved.value }
    }
}
