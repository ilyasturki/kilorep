<script lang="ts">
	import type { Exercise } from '$lib/domain/exercise';
	import { settleGrip } from '$lib/domain/grip';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';

	type Props = {
		meta: Exercise | undefined;
		/** What is in force here — a set's own grip, or the exercise's. */
		value: string | undefined;
		note?: string;
		onpick: (grip: string) => void;
	};

	let { meta, value, note, onpick }: Props = $props();

	const axis = $derived(meta?.grips);

	const settled = $derived(settleGrip(meta, value) ?? '');
</script>

{#if axis !== undefined}
	<div class="flex flex-col gap-2">
		<div class="flex items-baseline justify-between gap-2 px-1">
			<span class="label-caps">{axis.label}</span>
			{#if note}
				<span class="truncate text-sm font-bold text-ink-faint">{note}</span>
			{/if}
		</div>

		<!-- A toggle group can be turned off; an exercise cannot be gripped by nothing, so an
		     empty pick is read as tapping the value that is already on and left alone. -->
		<ChipGroup
			label={axis.label}
			bind:value={
				() => settled,
				(next) => {
					if (typeof next === 'string' && next !== '') {
						onpick(next);
					}
				}
			}
		>
			{#each axis.values as grip (grip.id)}
				<Chip value={grip.id}>{grip.label}</Chip>
			{/each}
		</ChipGroup>
	</div>
{/if}
