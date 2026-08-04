/**
 * potrace ships no types and has no `@types/` package. Only `trace` is used
 * here, and only in the one shape `trace.ts` calls it — the rest of the
 * package's surface is left undeclared on purpose, so a second caller has to
 * state what it needs rather than inherit a guess made here.
 */
declare module 'potrace' {
	export type TraceOptions = {
		threshold?: number;
		color?: string;
		turdSize?: number;
		optTolerance?: number;
		turnPolicy?: 'black' | 'white' | 'left' | 'right' | 'minority' | 'majority';
	};

	export function trace(
		file: string,
		options: TraceOptions,
		// This describes the callback the library has; `trace.ts` promisifies it.
		// oxlint-disable-next-line promise/prefer-await-to-callbacks
		callback: (error: Error | null, svg: string) => void
	): void;
}
