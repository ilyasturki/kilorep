<script lang="ts">
	import type { SetType } from '$lib/domain/workout';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';

	type Props = {
		value: SetType;
		onpick: (type: SetType) => void;
	};

	let { value, onpick }: Props = $props();

	const notes: Record<SetType, string> = {
		normal: 'Working set',
		warmup: 'Counts in nothing',
		drop: 'Counts as a working set',
		failure: 'Counts as a working set'
	};

	function typeOf(picked: string | string[] | undefined): SetType {
		return picked === 'warmup' || picked === 'drop' || picked === 'failure' ? picked : 'normal';
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-baseline justify-between gap-2 px-1">
		<span class="label-caps">Type</span>
		<span class="truncate text-sm font-bold text-ink-faint">{notes[value]}</span>
	</div>

	<!-- None lit is a working set, so turning the lit chip off is how a set goes back to one. -->
	<ChipGroup
		label="Set type"
		bind:value={() => (value === 'normal' ? '' : value), (next) => onpick(typeOf(next))}
	>
		<Chip value="warmup">Warmup</Chip>
		<Chip value="drop">Drop</Chip>
		<Chip value="failure">Failure</Chip>
	</ChipGroup>
</div>
