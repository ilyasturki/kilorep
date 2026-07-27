/**
 * The one JS read of the pointer type.
 *
 * CSS answers this question everywhere it can — the `--target-*` tokens and
 * every `pointer-fine:` utility — and JS is needed only where the difference is
 * structural rather than cosmetic: the numpad renders a key grid or a text
 * field, and no stylesheet can swap one element for the other.
 *
 * `pointer`, not `any-pointer`: the same predicate the tokens and the utilities
 * use, so a component cannot disagree with the sheet styling it. Read once at
 * module scope — a device does not sprout a touchscreen mid-session, and doing
 * it per component instance put a synchronous style-system call on the path
 * that opens the pad, which is the logging loop.
 *
 * Guarded because this file is imported by tests running under Node, where
 * there is no `matchMedia` and the honest answer is "not a touchscreen".
 */
export const coarsePointer: boolean =
	typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(pointer: coarse)').matches;
