package dev.kilorep.app.ui.screens

import dev.kilorep.app.data.Backend
import dev.kilorep.app.data.JsonStore
import dev.kilorep.app.data.Repo
import java.nio.file.Files
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer

class OnboardingViewModelTest {

    private val dispatcher = UnconfinedTestDispatcher()
    private lateinit var server: MockWebServer
    private lateinit var settings: FakeSettings
    private lateinit var viewModel: OnboardingViewModel

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        server = MockWebServer()
        server.start()
        settings = FakeSettings()
        val backend = Backend(settings, onAuthRejected = {})
        viewModel = OnboardingViewModel(
            settings,
            backend,
            Repo(
                backend = backend,
                files = JsonStore(Files.createTempDirectory("kilorep-test").toFile()),
                onDirtyDrafts = {},
            ),
        )
    }

    @AfterTest
    fun tearDown() {
        server.shutdown()
        Dispatchers.resetMain()
    }

    private fun baseUrl() = server.url("/").toString().trimEnd('/')

    @Test
    fun `single-user instance needs no sign-in at all`() {
        server.enqueue(
            MockResponse()
                .setBody("""{"authEnabled":false,"googleClientId":null}""")
                .setHeader("Content-Type", "application/json"),
        )
        // refreshAll: sessions, exercises, workouts.
        repeat(3) {
            server.enqueue(
                MockResponse().setBody("[]").setHeader("Content-Type", "application/json"),
            )
        }

        viewModel.probe(baseUrl())

        awaitUntil("onboarding completes") { viewModel.step.value == OnboardingStep.Done }
        assertEquals(baseUrl(), settings.current.serverUrl)
        assertTrue(settings.current.ready, "no credential needed without auth")
    }

    @Test
    fun `auth instance routes through Google with the server's client id`() {
        server.enqueue(
            MockResponse()
                .setBody("""{"authEnabled":true,"googleClientId":"abc.apps.example"}""")
                .setHeader("Content-Type", "application/json"),
        )

        viewModel.probe(baseUrl())

        awaitUntil("sign-in step reached") { viewModel.step.value is OnboardingStep.SignIn }
        val step = assertIs<OnboardingStep.SignIn>(viewModel.step.value)
        assertEquals("abc.apps.example", step.googleClientId)
        assertEquals(false, settings.current.ready)
    }

    @Test
    fun `device sign-in stores the minted token`() {
        server.enqueue(
            MockResponse().setBody(
                """{"token":"kr_minted","record":{"id":1,"label":"Pixel 9",
                   "tokenPrefix":"kr_minte","createdAt":"2026-06-12T10:00:00Z",
                   "lastUsedAt":null}}""",
            ).setHeader("Content-Type", "application/json"),
        )
        repeat(3) {
            server.enqueue(
                MockResponse().setBody("[]").setHeader("Content-Type", "application/json"),
            )
        }

        viewModel.signIn(baseUrl(), idToken = "fake-google-jwt", deviceName = "Pixel 9")

        val request = server.takeRequest(5, java.util.concurrent.TimeUnit.SECONDS)!!
        assertEquals("/api/auth/device", request.path)
        assertTrue(request.body.readUtf8().contains("\"idToken\":\"fake-google-jwt\""))
        awaitUntil("onboarding completes") { viewModel.step.value == OnboardingStep.Done }
        assertEquals("kr_minted", settings.current.deviceToken)
        assertTrue(settings.current.ready)
    }

    @Test
    fun `unreachable server surfaces an error instead of advancing`() {
        server.shutdown()

        viewModel.probe(baseUrl())

        awaitUntil("error surfaces") { viewModel.error.value != null }
        assertEquals(OnboardingStep.Server, viewModel.step.value)
        assertNotNull(viewModel.error.value)
    }
}
