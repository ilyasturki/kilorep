package dev.kilorep.app.ui

import androidx.compose.runtime.Composable
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.flow.StateFlow

/** Every screen reads repo flows; the long canonical name buys nothing. */
@Composable
fun <T> StateFlow<T>.watch(): T = collectAsStateWithLifecycle().value
