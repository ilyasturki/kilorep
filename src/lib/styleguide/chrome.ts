// The specimen sheet's own furniture, in one place so a card written today matches one written
// six months ago. Tailwind scans source text, so these are whole class strings and never
// composed at runtime.

export const card = 'flex flex-col gap-3 rounded-2xl bg-surface p-4';

export const caption = 'text-xs font-extrabold text-ink-faint';

export const specimen = 'flex flex-col items-start gap-1.5';

export const tile = 'grid size-8 place-items-center text-ink-muted';

export const chromeButton =
	'grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border border-line ' +
	'text-ink-muted focus-ring hover:bg-hover press:bg-surface-2';

// 22rem is the narrowest a card can be and still hold a stepper, a row and a full-width button
// without any of them lying about their size. `min(100%, …)` is what keeps a 360px phone from
// being handed a column wider than it has.
export const bento =
	'grid grid-flow-row-dense gap-4 ' +
	'[grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]';
