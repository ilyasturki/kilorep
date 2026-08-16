import { describe, expect, test } from 'vitest';

import {
	NOTE_PREFIX,
	REST_PREFIX,
	isNotePreference,
	noteId,
	restOverrideExercise
} from '$lib/domain/preference';

describe('exercise note ids', () => {
	test('a note is keyed by the slug it describes', () => {
		expect(noteId('bench-press')).toBe('note:bench-press');
	});

	test('the note prefix is not the rest prefix', () => {
		expect(NOTE_PREFIX).not.toBe(REST_PREFIX);
		expect(restOverrideExercise(noteId('bench-press'))).toBeNull();
	});
});

describe('isNotePreference', () => {
	test('a payload carrying text is a note', () => {
		expect(isNotePreference({ text: 'Seat 4' })).toBe(true);
	});

	// Nothing writes empty text now, but a device on an older build may have.
	test('empty text is still a note', () => {
		expect(isNotePreference({ text: '' })).toBe(true);
	});

	test('anything else is not', () => {
		expect(isNotePreference({ text: 4 })).toBe(false);
		expect(isNotePreference({ seconds: 90 })).toBe(false);
		expect(isNotePreference({})).toBe(false);
		expect(isNotePreference(null)).toBe(false);
		expect(isNotePreference('Seat 4')).toBe(false);
		expect(isNotePreference(['Seat 4'])).toBe(false);
	});
});
