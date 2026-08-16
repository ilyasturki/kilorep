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
		// oxlint-disable-next-line promise/prefer-await-to-callbacks
		callback: (error: Error | null, svg: string) => void
	): void;
}
