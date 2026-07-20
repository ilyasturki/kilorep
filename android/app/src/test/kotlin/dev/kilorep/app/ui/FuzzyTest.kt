package dev.kilorep.app.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FuzzyTest {

    private fun match(label: String, keywords: List<String> = emptyList(), query: String) =
        fuzzyMatch(label, keywords, fuzzyTokens(query))

    @Test
    fun initialsMatchAcrossWords() {
        val m = assertNotNull(match("Bench Press", query = "bp"))
        assertEquals(listOf(0, 6), m.labelPositions)
    }

    @Test
    fun tokensMatchInAnyOrder() {
        assertNotNull(match("Bench Press", query = "press bench"))
    }

    @Test
    fun everyTokenMustMatch() {
        assertNull(match("Bench Press", query = "bench curl"))
    }

    @Test
    fun charactersMustAppearInOrder() {
        assertNull(match("Squat", query = "tq"))
    }

    @Test
    fun noMatchReturnsNull() {
        assertNull(match("Squat", query = "xyz"))
    }

    @Test
    fun emptyQueryMatchesEverythingWithZeroScore() {
        val m = assertNotNull(match("Squat", query = "  "))
        assertEquals(0, m.score)
        assertTrue(m.labelPositions.isEmpty())
    }

    @Test
    fun diacriticsFoldButPositionsIndexTheRawText() {
        val m = assertNotNull(match("Développé couché", query = "devco"))
        // é folds to e, so "dev" lands on "Dév" and "co" on "cou".
        assertEquals(listOf(0, 1, 2, 10, 11), m.labelPositions)
    }

    @Test
    fun aliasHitReportsTheKeyword() {
        val m = assertNotNull(
            match("Overhead Press", keywords = listOf("Military Press"), query = "military"),
        )
        assertEquals("Military Press", m.matchedKeyword)
        assertTrue(m.labelPositions.isEmpty())
        assertEquals((0..7).toList(), m.keywordPositions)
    }

    @Test
    fun labelBeatsAnEqualKeywordMatch() {
        val m = assertNotNull(match("Bench Press", keywords = listOf("Bench Press"), query = "bench"))
        assertNull(m.matchedKeyword)
        assertEquals(listOf(0, 1, 2, 3, 4), m.labelPositions)
    }

    @Test
    fun wordStartsOutscoreScatteredMatches() {
        val wordStarts = assertNotNull(match("Bench Press", query = "bp"))
        val scattered = assertNotNull(match("Barbell Complex", query = "bp"))
        assertTrue(wordStarts.score > scattered.score)
    }

    @Test
    fun consecutiveRunsOutscoreGaps() {
        val contiguous = assertNotNull(match("Bench Press", query = "bench"))
        val gapped = assertNotNull(match("Back Extension Chair", query = "bench"))
        assertTrue(contiguous.score > gapped.score)
    }
}
