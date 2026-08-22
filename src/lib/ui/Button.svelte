<script lang="ts" module>
	type Variant = 'commit' | 'secondary' | 'destructive' | 'chrome' | 'raised';

	type Look = Variant | 'inert';

	const base =
		'inline-flex items-center justify-center gap-3 select-none focus-ring ' +
		'pointer-fine:transition-[background-color,color,filter] pointer-fine:duration-100 ' +
		'disabled:pointer-events-none';

	const outlined =
		'min-h-row-dense rounded-xl px-5 border border-line hover:bg-hover press:bg-surface-2 press-sink';

	const filled =
		'bg-accent text-on-accent press-sink ' +
		'hover:bg-accent-hover press:[filter:var(--accent-press)] pointer-fine:active:translate-y-px';

	const well = 'border-[1.5px] border-dashed border-line text-ink-faint';

	type Dress = { shape: string; text: string; caps: string };

	const looks: Record<Look, Dress> = {
		commit: {
			shape: `min-h-commit rounded-2xl px-6 ${filled}`,
			text: 'text-xl font-[800]',
			caps: 'text-lg font-[800] tracking-caps'
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
				'hover:bg-hover press:bg-surface-2',
			text: 'text-md font-extrabold',
			caps: 'text-sm font-extrabold tracking-caps'
		},
		raised: {
			shape:
				'min-h-row rounded-xl px-5 bg-surface text-ink-muted ' +
				'hover:bg-hover press:bg-surface-2 press-sink',
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
			text: 'text-lg font-[800]',
			caps: 'text-md font-[800] tracking-caps'
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
	import { press } from '$lib/ui/press';

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

<svelte:element
	this={href ? 'a' : 'button'}
	{href}
	disabled={href ? undefined : disabled}
	class={[base, look.shape, caps ? look.caps : look.text, klass]}
	{...rest}
	{@attach press()}
>
	{@render children()}
</svelte:element>
