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
		// For a mark drawn on an accent-soft ground, where the done tint would melt into it.
		contrast?: boolean;
		// W in every state: a check on a logged warmup would read as a working set.
		warmup?: boolean;
		/** A superset leg's letter. The mark then names its leg in every state, done included. */
		leg?: string;
	};

	let { status, index, contrast = false, warmup = false, leg }: Props = $props();

	const warm = $derived(warmup || status === 'warmup');

	const text = $derived(warm ? `${leg ?? ''}W` : `${leg ?? ''}${index ?? ''}`);

	const label = $derived.by(() => {
		if (leg !== undefined) {
			return `set ${text} ${status === 'done' ? 'logged' : status}`;
		}

		return warmup && status !== 'warmup'
			? `warmup ${status === 'done' ? 'logged' : status}`
			: (fixedLabels[status] ?? `set ${index ?? ''} ${status}`.trim());
	});
</script>

<div
	role="img"
	aria-label={label}
	class={[
		'grid size-8 shrink-0 place-items-center rounded-full font-extrabold',
		text.length > 2 ? 'text-sm tracking-tight' : 'text-md',
		contrast && status === 'done' ? 'bg-surface text-accent-text' : shells[status]
	]}
>
	{#if status === 'done' && !warm && leg === undefined}
		<Check size={17} />
	{:else}
		{text}
	{/if}
</div>
