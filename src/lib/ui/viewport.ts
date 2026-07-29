import { MediaQuery } from 'svelte/reactivity';

/**
 * The one JS read of the `sm` breakpoint.
 *
 * Same argument as `pointer.ts`, one axis over: CSS answers the width question
 * everywhere it can — `overlay-sheet` swaps a bottom sheet for a centred dialog
 * from `sm` up with no JS involved — and this exists only where the difference
 * is structural. Select and DatePicker render a *different Bits UI part* on a
 * wide viewport: `Content`, anchored to the trigger by Floating UI, instead of
 * `ContentStatic` wearing the sheet. No stylesheet can swap one element for the
 * other, which is the same wall the numpad and Tooltip hit on pointer type.
 *
 * Reactive, unlike `coarsePointer`: a device does not sprout a touchscreen
 * mid-session, but a window is resized and a phone is rotated, and both cross
 * this line while a picker may be open.
 *
 * `40rem` is `--breakpoint-sm` written out, because `theme()` is a stylesheet
 * function and this is not a stylesheet. It has to be the same line
 * `overlay-sheet` turns on: a dropdown rendered while the sheet geometry still
 * believes it is a sheet is a panel welded to the bottom of the window.
 *
 * The fallback is `false` — phone shape, the sheet — for the server that never
 * comes. `ssr = false` is app-wide, so nothing that imports this renders
 * without a `window`; the argument is there because the honest answer to
 * "how wide is a viewport that does not exist" is not `true`.
 */
export const wideViewport = new MediaQuery('min-width: 40rem', false);
