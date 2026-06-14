package dev.kilorep.app.ui.screens

import kotlin.test.fail

/**
 * The repo does its network work on real IO dispatchers, so ViewModel tests
 * wait for observable state instead of faking time.
 */
fun awaitUntil(what: String = "condition", timeoutMs: Long = 5000, condition: () -> Boolean) {
    val deadline = System.currentTimeMillis() + timeoutMs
    while (System.currentTimeMillis() < deadline) {
        if (condition()) return
        Thread.sleep(10)
    }
    fail("$what not met within ${timeoutMs}ms")
}
