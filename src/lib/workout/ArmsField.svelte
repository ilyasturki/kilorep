<script lang="ts">
	import type { Arms } from '$lib/domain/workout';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';

	type Props = {
		value: Arms;
		onpick: (arms: Arms) => void;
	};

	let { value, onpick }: Props = $props();
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-baseline justify-between gap-2 px-1">
		<span class="label-caps">Arms</span>
		<span class="truncate text-sm font-bold text-ink-faint">Recorded, not counted</span>
	</div>

	<ChipGroup
		label="Arms"
		bind:value={
			() => value,
			(next) => {
				if (next === 'both' || next === 'one') {
					onpick(next);
				}
			}
		}
	>
		<Chip value="both">Both</Chip>
		<Chip value="one">One arm</Chip>
	</ChipGroup>
</div>
