<script lang="ts" module>
	/**
	 * The 32px disc at the head of a set row: done, active, pending, warmup.
	 *
	 * One vocabulary for one concept — `SetRow` imports this type rather than
	 * keeping a second union and a table to translate between them.
	 *
	 * Note which token the active ring uses. `accent` is lime-400 and it is a
	 * fill only — as a 2px ring on a light surface it measures 1.51:1, well
	 * under the 3:1 that WCAG requires of a control boundary, and the active set
	 * is exactly the status a user has to find at arm's length. `accent-text`
	 * resolves to lime-700 in light and back to lime-400 in dark, so dark is
	 * pixel-identical to the design and light is legible.
	 */
	export type SetStatus = 'done' | 'active' | 'pending' | 'warmup';

	// A done disc wears a check and a warmup disc a W, so neither reads its index.
	const fixedLabels: Partial<Record<SetStatus, string>> = {
		done: 'set logged',
		warmup: 'warmup set'
	};

	const shells: Record<SetStatus, string> = {
		done: 'bg-accent text-on-accent',
		active: 'border-2 border-accent-text text-accent-text',
		pending: 'border-[1.5px] border-line text-ink-faint',
		warmup: 'border-[1.5px] border-line text-ink-muted'
	};
</script>

<script lang="ts">
	import Check from '$lib/ui/icons/Check.svelte';
	import { cn } from '$lib/ui/cn';

	type Props = {
		status: SetStatus;
		/** Set number. Ignored for `done` (a check) and `warmup` (a W). */
		index?: number;
		class?: string;
	};

	let { status, index, class: klass }: Props = $props();

	const label = $derived(fixedLabels[status] ?? `set ${index ?? ''} ${status}`.trim());
</script>

<div
	role="img"
	aria-label={label}
	class={cn(
		'grid size-8 shrink-0 place-items-center rounded-full text-md font-extrabold',
		shells[status],
		klass
	)}
>
	{#if status === 'done'}
		<Check size={17} />
	{:else if status === 'warmup'}
		W
	{:else}
		{index ?? ''}
	{/if}
</div>
