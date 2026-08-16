export const coarsePointer: boolean =
	typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(pointer: coarse)').matches;
