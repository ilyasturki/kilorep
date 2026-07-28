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

	// `size` is split from `shape` so exactly one type scale ever reaches the
	// element: `caps` replaces the look's scale instead of being appended
	// alongside it. Two font sizes in one class attribute is not a tie broken by
	// order of appearance — Tailwind breaks it by stylesheet order, where
	// `text-sm` loses to `text-2xl` no matter which was written last.
	const looks: Record<Look, { shape: string; size: string }> = {
		commit: {
			shape:
				'min-h-commit rounded-2xl px-6 font-extrabold bg-accent text-on-accent ' +
				'hover:brightness-[0.97] active:brightness-[0.94] active:translate-y-px',
			size: 'text-2xl tracking-tight'
		},
		secondary: { shape: `${outlined} font-bold text-ink-muted`, size: 'text-md' },
		destructive: { shape: `${outlined} font-extrabold text-danger`, size: 'text-md' },
		chrome: {
			shape:
				'min-h-chrome rounded-full px-4 font-extrabold border border-line text-ink-muted ' +
				'hover:bg-surface-2 active:bg-surface-2',
			size: 'text-md'
		},
		inert: {
			shape:
				'min-h-commit rounded-2xl px-6 font-bold border-[1.5px] border-dashed border-line text-ink-faint',
			size: 'text-base'
		}
	};

	const capsSize = 'text-sm tracking-caps';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		variant?: Variant;
		/** Caps label with letter-spacing — FINISH, SKIP, CLOSE. */
		caps?: boolean;
		children: Snippet;
	};

	let {
		variant = 'secondary',
		caps = false,
		disabled = false,
		class: klass,
		children,
		...rest
	}: Props = $props();

	const look = $derived(looks[disabled && variant === 'commit' ? 'inert' : variant]);
</script>

<button {disabled} class={[base, look.shape, caps ? capsSize : look.size, klass]} {...rest}>
	{@render children()}
</button>
