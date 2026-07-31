<script lang="ts" module>
	/**
	 * Only one filled button exists per screen — the commit. Everything else is
	 * outlined; that rule is what keeps the accent meaning "this logs the set".
	 *
	 * A disabled `commit` is not a dimmed commit: it becomes the dashed inert
	 * well the design draws for "Enter a weight to log". Same slot, same height,
	 * unmistakably not pressable.
	 */
	type Variant = 'commit' | 'secondary' | 'destructive' | 'chrome';

	/**
	 * A disabled commit is its own look, not a state of `commit`, so it is a
	 * fifth row here rather than a branch at the call site.
	 */
	type Look = Variant | 'inert';

	// The design is explicit that a press is instant — "sweaty hands need the
	// target to be still". A mouse has no such problem and reads better with a
	// short fade, so the transition is granted to fine pointers only.
	const base =
		'inline-flex items-center justify-center gap-3 select-none focus-ring ' +
		'pointer-fine:transition-[background-color,color,filter] pointer-fine:duration-100 ' +
		'disabled:pointer-events-none';

	const outlined =
		'min-h-14 rounded-xl px-5 border border-line hover:bg-surface-2 active:bg-surface-2';

	// The paint is split from the box it goes on, because both of these come in
	// two sizes and only the box changes between them.
	const filled =
		'font-extrabold bg-accent text-on-accent ' +
		'hover:brightness-[0.97] active:brightness-[0.94] active:translate-y-px';

	const well = 'font-bold border-[1.5px] border-dashed border-line text-ink-faint';

	// `size` is split from `shape` so exactly one type scale ever reaches the
	// element: `caps` replaces the look's scale instead of being appended
	// alongside it. Two font sizes in one class attribute is not a tie broken by
	// order of appearance — Tailwind breaks it by stylesheet order, where
	// `text-sm` loses to `text-2xl` no matter which was written last.
	const looks: Record<Look, { shape: string; size: string }> = {
		commit: { shape: `min-h-commit rounded-2xl px-6 ${filled}`, size: 'text-2xl tracking-tight' },
		secondary: { shape: `${outlined} font-bold text-ink-muted`, size: 'text-md' },
		destructive: { shape: `${outlined} font-extrabold text-danger`, size: 'text-md' },
		chrome: {
			shape:
				'min-h-chrome rounded-full px-4 font-extrabold border border-line text-ink-muted ' +
				'hover:bg-surface-2 active:bg-surface-2',
			size: 'text-md'
		},
		inert: { shape: `min-h-commit rounded-2xl px-6 ${well}`, size: 'text-base' }
	};

	/**
	 * The commit at ordinary scale, for the screens that are not the gym floor.
	 *
	 * 78px of 28px type is sized for a thumb at arm's length between sets. A
	 * sign-in button is pressed once and read from a foot away, and at commit
	 * scale it wraps inside a card and outranks the heading above it.
	 *
	 * Only the two filled looks have a compact form. The outlined variants were
	 * never gym-sized, so there is nothing for them to shrink to — `compact` is
	 * silently nothing on those rather than a second size to keep in step.
	 */
	const compacts: Partial<Record<Look, { shape: string; size: string }>> = {
		commit: { shape: `min-h-row rounded-xl px-5 ${filled}`, size: 'text-lg tracking-tight' },
		inert: { shape: `min-h-row rounded-xl px-5 ${well}`, size: 'text-md' }
	};

	const capsSize = 'text-sm tracking-caps';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	/**
	 * The anchor attributes are picked rather than intersected: `HTMLButtonAttributes`
	 * and `HTMLAnchorAttributes` disagree on `type`, and intersecting them collapses
	 * it to `never`. These three are the ones a link actually needs.
	 */
	type Props = HTMLButtonAttributes &
		Pick<HTMLAnchorAttributes, 'href' | 'target' | 'rel'> & {
			variant?: Variant;
			/** Caps label with letter-spacing — FINISH, SKIP, CLOSE. */
			caps?: boolean;
			/** A commit at row height rather than gym height. Nothing on the outlined variants. */
			compact?: boolean;
			children: Snippet;
		};

	let {
		variant = 'secondary',
		caps = false,
		compact = false,
		disabled = false,
		href,
		class: klass,
		children,
		...rest
	}: Props = $props();

	const key = $derived(disabled && variant === 'commit' ? ('inert' as const) : variant);
	const look = $derived((compact ? compacts[key] : undefined) ?? looks[key]);
	const klasses = $derived([base, look.shape, caps ? capsSize : look.size, klass]);
</script>

<!--
	`<svelte:element>` rather than two branches. Two branches read better but do
	not typecheck: `rest` is button-shaped down to its ~450 event handlers, and
	spreading a `ClipboardEventHandler<HTMLButtonElement>` onto an `<a>` is an
	error. The alternative was casting the spread, which hides the same looseness
	somewhere less obvious.

	`disabled` is forced to `undefined` on a link — an anchor has no such
	attribute, and the inert look is a disabled *commit*, which a link never is.
-->
<svelte:element
	this={href ? 'a' : 'button'}
	{href}
	disabled={href ? undefined : disabled}
	class={klasses}
	{...rest}
>
	{@render children()}
</svelte:element>
