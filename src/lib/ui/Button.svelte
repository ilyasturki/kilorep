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

	// The design is explicit that a press is instant — "sweaty hands need the
	// target to be still". A mouse has no such problem and reads better with a
	// short fade, so the transition is granted to fine pointers only.
	const base =
		'inline-flex items-center justify-center gap-3 font-extrabold select-none focus-ring ' +
		'pointer-fine:transition-[background-color,color,filter] pointer-fine:duration-100 ' +
		'disabled:pointer-events-none';

	const outlined =
		'min-h-14 rounded-xl px-5 text-md border border-line hover:bg-surface-2 active:bg-surface-2';

	const variants: Record<Variant, string> = {
		commit:
			'min-h-commit rounded-2xl px-6 text-2xl tracking-tight bg-accent text-on-accent ' +
			'hover:brightness-[0.97] active:brightness-[0.94] active:translate-y-px',
		secondary: `${outlined} font-bold text-ink-muted`,
		destructive: `${outlined} text-danger`,
		chrome:
			'min-h-chrome rounded-full px-4 text-md border border-line text-ink-muted ' +
			'hover:bg-surface-2 active:bg-surface-2'
	};

	const inert =
		'min-h-commit rounded-2xl px-6 text-base font-bold border-[1.5px] border-dashed border-line text-ink-faint';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/ui/cn';

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

	const shape = $derived(disabled && variant === 'commit' ? inert : variants[variant]);
</script>

<button {disabled} class={cn(base, shape, caps && 'text-sm tracking-caps', klass)} {...rest}>
	{@render children()}
</button>
