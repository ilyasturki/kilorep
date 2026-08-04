<script lang="ts" module>
	type Variant = 'commit' | 'secondary' | 'destructive' | 'chrome' | 'raised';

	type Look = Variant | 'inert';

	const base =
		'inline-flex items-center justify-center gap-3 select-none focus-ring ' +
		'pointer-fine:transition-[background-color,color,filter] pointer-fine:duration-100 ' +
		'disabled:pointer-events-none';

	const outlined = 'min-h-14 rounded-xl px-5 border border-line hover:bg-hover active:bg-surface-2';

	const filled =
		'bg-accent text-on-accent ' +
		'hover:bg-accent-hover active:[filter:var(--accent-press)] active:translate-y-px';

	const well = 'border-[1.5px] border-dashed border-line text-ink-faint';

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

	type Props = HTMLButtonAttributes &
		Pick<HTMLAnchorAttributes, 'href' | 'target' | 'rel'> & {
			variant?: Variant;
			caps?: boolean;
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
