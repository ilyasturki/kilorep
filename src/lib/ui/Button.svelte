<script lang="ts" module>
	/**
	 * Only one filled button exists per screen — the commit. Everything else is
	 * outlined; that rule is what keeps the accent meaning "this logs the set".
	 *
	 * A disabled `commit` is not a dimmed commit: it becomes the dashed inert
	 * well the design draws for "Enter a weight to log". Same slot, same height,
	 * unmistakably not pressable.
	 *
	 * `raised` is the one look filled with something, and it does not break that
	 * rule: it is painted `surface`, the colour a card already is, so it reads as
	 * a piece of the list it grows rather than as a thing that logs anything. It
	 * exists because the dashed grow-by-one row is the right silhouette *inside*
	 * a card and the wrong one alone on the canvas — on the Templates tab it sat
	 * under a solid card of rows and read as a hairline nobody could find. Only
	 * for a row standing on `canvas`: on `surface` it disappears into what it is
	 * standing on, which is why the session rail and the workout blocks keep the
	 * dashed `AddRow`.
	 */
	type Variant = 'commit' | 'secondary' | 'destructive' | 'chrome' | 'raised';

	type Look = Variant | 'inert';

	// The design is explicit that a press is instant — "sweaty hands need the
	// target to be still". A mouse has no such problem and reads better with a
	// short fade, so the transition is granted to fine pointers only.
	const base =
		'inline-flex items-center justify-center gap-3 select-none focus-ring ' +
		'pointer-fine:transition-[background-color,color,filter] pointer-fine:duration-100 ' +
		'disabled:pointer-events-none';

	const outlined = 'min-h-14 rounded-xl px-5 border border-line hover:bg-hover active:bg-surface-2';

	// The paint is split from the box it goes on, because both of these come in
	// two sizes and only the box changes between them.
	//
	// Hover is a fill and not a filter, which is what every outlined variant
	// above already does — one mechanism for "the pointer is on this", and a
	// named colour per theme rather than a percentage of whatever the accent
	// happens to be. The press stays a filter deliberately: it has to darken the
	// hover colour under a mouse and the accent under a thumb, and only a filter
	// is agnostic about which one it lands on. Both values are theme-paired in
	// `app.css` — see the `--accent-hover` block.
	const filled =
		'bg-accent text-on-accent ' +
		'hover:bg-accent-hover active:[filter:var(--accent-press)] active:translate-y-px';

	const well = 'border-[1.5px] border-dashed border-line text-ink-faint';

	/**
	 * A look is a box and the type that goes in it, and `text` carries the whole
	 * type dress — size, tracking *and* weight — so that exactly one of each
	 * reaches the element. `caps` replaces that dress rather than being appended
	 * alongside it: two font sizes in one class attribute is not a tie broken by
	 * order of appearance, and neither is two weights. Tailwind breaks both by
	 * stylesheet order, where `text-sm` loses to `text-2xl` and `font-bold` to
	 * `font-extrabold` no matter which was written last.
	 *
	 * Caps is per look and not one constant, which is what it used to be. FINISH
	 * has to read as the same word in the header's 44px pill and in the 78px
	 * button at the foot of a session, and one fixed 13px cannot do that job in
	 * both — at commit scale it is a caption lost in a slab. So each look states
	 * the caps size its box can carry, one step down from its sentence-case
	 * dress: caps at the same size reads larger than the words around it, and
	 * dropping a step is what keeps a caps label from shouting.
	 */
	type Dress = { shape: string; text: string; caps: string };

	const looks: Record<Look, Dress> = {
		commit: {
			shape: `min-h-commit rounded-2xl px-6 ${filled}`,
			text: 'text-2xl font-extrabold tracking-tight',
			caps: 'text-xl font-extrabold tracking-caps'
		},
		secondary: {
			shape: `${outlined} text-ink-muted`,
			text: 'text-md font-bold',
			caps: 'text-md font-extrabold tracking-caps'
		},
		destructive: {
			shape: `${outlined} text-danger`,
			text: 'text-md font-extrabold',
			caps: 'text-md font-extrabold tracking-caps'
		},
		chrome: {
			shape:
				'min-h-chrome rounded-full px-4 border border-line text-ink-muted ' +
				'hover:bg-hover active:bg-surface-2',
			text: 'text-md font-extrabold',
			caps: 'text-sm font-extrabold tracking-caps'
		},
		// `line-soft`, not `line`: this sits beside `list-group` cards and has to
		// be bounded exactly as they are, or the row reads as a heavier object
		// than the list it belongs to.
		raised: {
			shape:
				'min-h-row rounded-xl px-5 border border-line-soft bg-surface text-ink-muted ' +
				'hover:bg-hover active:bg-surface-2',
			text: 'text-md font-bold',
			caps: 'text-sm font-extrabold tracking-caps'
		},
		inert: {
			shape: `min-h-commit rounded-2xl px-6 ${well}`,
			text: 'text-base font-bold',
			caps: 'text-sm font-bold tracking-caps'
		}
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
	const compacts: Partial<Record<Look, Dress>> = {
		commit: {
			shape: `min-h-row rounded-xl px-5 ${filled}`,
			text: 'text-lg font-extrabold tracking-tight',
			caps: 'text-md font-extrabold tracking-caps'
		},
		inert: {
			shape: `min-h-row rounded-xl px-5 ${well}`,
			text: 'text-md font-bold',
			caps: 'text-sm font-bold tracking-caps'
		}
	};
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
	class={[base, look.shape, caps ? look.caps : look.text, klass]}
	{...rest}
>
	{@render children()}
</svelte:element>
