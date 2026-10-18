import { describe, expect, test } from 'vitest';

import { parseEntry } from '$lib/domain/workout';

import { LOCALE, dateFormat, decimal, deviceLocale, numberFormat, shown } from './locale.ts';

const OCT_18 = Date.UTC(2026, 9, 18, 12);

describe('deviceLocale', () => {
	test('takes the device’s own French or English, region and all', () => {
		expect(deviceLocale(['fr-FR', 'en-GB'])).toBe('fr-FR');
		expect(deviceLocale(['fr-CA'])).toBe('fr-CA');
		expect(deviceLocale(['en-US'])).toBe('en-US');
	});

	test('skips a language the app does not speak for the next one it does', () => {
		expect(deviceLocale(['de-DE', 'fr-BE', 'en-GB'])).toBe('fr-BE');
	});

	test('falls back to English when nothing it speaks is offered', () => {
		expect(deviceLocale(['de-DE', 'ja'])).toBe('en-GB');
		expect(deviceLocale([])).toBe('en-GB');
	});

	test('passes over a tag that is not one', () => {
		expect(deviceLocale(['not a locale', 'fr'])).toBe('fr');
	});

	test('without a browser it is English, so the server and the tests never drift', () => {
		expect(LOCALE).toBe('en-GB');
	});
});

describe('dates', () => {
	const day = { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' } as const;

	test('in English', () => {
		expect(dateFormat(day, 'en-GB').format(OCT_18)).toBe('Sun 18 Oct');
	});

	test('in French', () => {
		expect(dateFormat(day, 'fr-FR').format(OCT_18)).toBe('dim. 18 oct.');
	});
});

describe('numbers', () => {
	test('a weight keeps its own decimal mark', () => {
		expect(decimal(82.5, 'en-GB')).toBe('82.5');
		expect(decimal(82.5, 'fr-FR')).toBe('82,5');
		expect(decimal(1.25, 'fr-FR')).toBe('1,25');
		expect(decimal(80, 'fr-FR')).toBe('80');
	});

	test('what is shown can be typed back as the same number', () => {
		for (const kg of [82.5, 1.25, 1250, 0.5]) {
			expect(parseEntry(decimal(kg, 'fr-FR'))).toBe(kg);
			expect(parseEntry(decimal(kg, 'en-GB'))).toBe(kg);
		}
	});

	test('a blank reads as a dash', () => {
		expect(shown(null, 'fr-FR')).toBe('–');
		expect(shown(82.5, 'fr-FR')).toBe('82,5');
	});

	test('a tally groups its thousands the local way', () => {
		const whole = { maximumFractionDigits: 0 };

		expect(numberFormat(whole, 'en-GB').format(12_450)).toBe('12,450');
		expect(numberFormat(whole, 'fr-FR').format(12_450)).toBe('12 450');
	});
});
