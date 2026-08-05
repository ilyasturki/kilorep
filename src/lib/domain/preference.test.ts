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

	// The two prefixes share the `preference` kind and the same index, so the
	// scan that reads every rest override walks the notes too. It has to leave
	// them alone: a note read as an override would come back as a duration.
	test('the note prefix is not the rest prefix', () => {
		expect(NOTE_PREFIX).not.toBe(REST_PREFIX);
		expect(restOverrideExercise(noteId('bench-press'))).toBeNull();
	});
});

describe('isNotePreference', () => {
	test('a payload carrying text is a note', () => {
		expect(isNotePreference({ text: 'Seat 4' })).toBe(true);
	});

	// Empty is a legal payload even though nothing writes one — a device on an
	// older build may have, and reading it as a note that says nothing is
	// honest, where rejecting it would show the `Add note` row over a record
	// that exists.
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
