<script lang="ts" module>
	export type SetStatus = 'done' | 'active' | 'pending' | 'warmup';

	const fixedLabels: Partial<Record<SetStatus, string>> = {
		done: 'set logged',
		warmup: 'warmup set'
	};

	// `done` is a tint, not a fill: a workout draws twenty of them, and one filled control per screen.
	const shells: Record<SetStatus, string> = {
		done: 'bg-accent-soft text-accent-text',
		active: 'border-2 border-accent-text text-accent-text',
		pending: 'border-[1.5px] border-line text-ink-faint',
		warmup: 'border-[1.5px] border-line text-ink-muted'
	};
</script>

<script lang="ts">
	import Check from '$lib/ui/icons/Check.svelte';

	type Props = {
		status: SetStatus;
		index?: number;
	};

	let { status, index }: Props = $props();

	const label = $derived(fixedLabels[status] ?? `set ${index ?? ''} ${status}`.trim());
</script>

<div
	role="img"
	aria-label={label}
	class={[
		'grid size-8 shrink-0 place-items-center rounded-full text-md font-extrabold',
		shells[status]
	]}
>
	{#if status === 'done'}
		<Check size={17} />
	{:else if status === 'warmup'}
		W
	{:else}
		{index ?? ''}
	{/if}
</div>
