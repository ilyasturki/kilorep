package dev.kilorep.app.ui.screens

import android.os.Build
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import dev.kilorep.app.ui.components.GhostButton
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.LiftTextField
import dev.kilorep.app.ui.components.PrimaryButton
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/**
 * Server-first onboarding. Single-user instances finish at the URL; auth
 * instances continue into the system account picker — no browser, no
 * redirect.
 */
@Composable
fun OnboardingScreen(viewModel: OnboardingViewModel) {
    val step by viewModel.step.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val colors = Lift.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var url by remember { mutableStateOf(viewModel.initialUrl) }

    LiftScreen {
        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp)
                .imePadding(),
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                "KILOREP",
                style = LiftType.title,
                color = colors.accent,
            )
            Text(
                "Sessions prescribe the plan. Workouts record the gym.",
                style = LiftType.secondary,
                color = colors.ink2,
                modifier = Modifier.padding(top = 6.dp, bottom = 32.dp),
            )

            when (val current = step) {
                OnboardingStep.Probing -> {
                    Kicker("Connecting")
                    Text(
                        "Reaching ${OnboardingViewModel.DEFAULT_SERVER}…",
                        style = LiftType.secondary,
                        color = colors.ink2,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }

                OnboardingStep.Server, OnboardingStep.Done -> {
                    Kicker("Your server")
                    LiftTextField(
                        value = url,
                        onValueChange = { url = it },
                        placeholder = "kilorep.example.com",
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp, bottom = 12.dp),
                    )
                    PrimaryButton(
                        if (busy) "Connecting…" else "Connect",
                        onClick = { viewModel.probe(url) },
                        enabled = !busy && url.isNotBlank(),
                        modifier = Modifier.fillMaxWidth(),
                        height = 52.dp,
                    )
                }

                is OnboardingStep.SignIn -> {
                    Kicker("Sign in")
                    Text(
                        "This instance uses Google accounts. Pick yours to mint " +
                            "this device's token — revocable any time from web settings.",
                        style = LiftType.secondary,
                        color = colors.ink2,
                        modifier = Modifier.padding(top = 8.dp, bottom = 12.dp),
                    )
                    PrimaryButton(
                        if (busy) "Signing in…" else "Continue with Google",
                        enabled = !busy,
                        onClick = {
                            scope.launch {
                                try {
                                    val request = GetCredentialRequest.Builder()
                                        .addCredentialOption(
                                            GetGoogleIdOption.Builder()
                                                .setServerClientId(current.googleClientId)
                                                .setFilterByAuthorizedAccounts(false)
                                                .build(),
                                        )
                                        .build()
                                    val result = CredentialManager.create(context)
                                        .getCredential(context, request)
                                    val credential = result.credential
                                    if (
                                        credential is CustomCredential
                                        && credential.type ==
                                        GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                                    ) {
                                        val idToken = GoogleIdTokenCredential
                                            .createFrom(credential.data)
                                            .idToken
                                        viewModel.signIn(
                                            current.serverUrl,
                                            idToken,
                                            deviceName(),
                                        )
                                    } else {
                                        viewModel.signInFailed("Unexpected credential type")
                                    }
                                } catch (e: CancellationException) {
                                    // Rotation while the picker is open must
                                    // not surface as a sign-in error on the
                                    // activity-scoped ViewModel.
                                    throw e
                                } catch (e: Exception) {
                                    viewModel.signInFailed(
                                        e.message ?: "Sign-in was cancelled",
                                    )
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        height = 52.dp,
                    )
                    GhostButton(
                        "Use a different server",
                        onClick = viewModel::backToServer,
                        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    )
                }
            }

            if (error != null) {
                Text(
                    error ?: "",
                    style = LiftType.secondary,
                    fontWeight = FontWeight.W600,
                    color = colors.danger,
                    modifier = Modifier.padding(top = 14.dp),
                )
            }
        }
    }
}

private fun deviceName(): String =
    "${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}".trim()
