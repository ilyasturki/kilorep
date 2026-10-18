const FALLBACK = 'en-GB';

const SPOKEN = new Set(['en', 'fr']);

export function deviceLocale(languages: readonly string[]): string {
	for (const tag of languages) {
		let canonical: string;

		try {
			[canonical] = Intl.getCanonicalLocales(tag);
		} catch {
			continue;
		}

		if (SPOKEN.has(new Intl.Locale(canonical).language)) {
			return canonical;
		}
	}

	return FALLBACK;
}

// No `window` is the server and the tests: MCP and every assertion read the same fixed locale.
export const LOCALE =
	globalThis.window === undefined ? FALLBACK : deviceLocale(navigator.languages);

export function dateFormat(
	options: Intl.DateTimeFormatOptions,
	locale = LOCALE
): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale, options);
}

export function numberFormat(
	options: Intl.NumberFormatOptions,
	locale = LOCALE
): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, options);
}

const DECIMALS = new Map<string, Intl.NumberFormat>();

// Ungrouped, so what is shown parses back through `parseEntry`.
export function decimal(value: number, locale = LOCALE): string {
	let format = DECIMALS.get(locale);

	if (format === undefined) {
		format = numberFormat({ maximumFractionDigits: 2, useGrouping: false }, locale);
		DECIMALS.set(locale, format);
	}

	return format.format(value);
}

export function shown(value: number | null, locale = LOCALE): string {
	return value === null ? '–' : decimal(value, locale);
}
