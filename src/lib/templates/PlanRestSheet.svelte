<script lang="ts">
	import { restLabel, restSecondsFor } from '$lib/domain/rest';
	import { restSettings } from '$lib/settings/rest.svelte';
	import RestDurationField from '$lib/settings/RestDurationField.svelte';
	import type { Planned } from '$lib/templates/plan';
	import Button from '$lib/ui/Button.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import Switch from '$lib/ui/Switch.svelte';

	type Props = {
		open?: boolean;
		group: Planned | null;
		onchange: (seconds: number | null | undefined) => void;
	};

	let { open = $bindable(false), group, onchange }: Props = $props();

	const planned = $derived(group?.exercise.restSeconds);

	const inherited = $derived(
		group === null
			? restSettings.current.seconds
			: restSecondsFor(group.meta.id, restSettings.current)
	);

	const effective = $derived(planned === undefined ? inherited : planned);

	const rests = $derived(effective !== null);

	const shown = $derived(effective ?? inherited ?? restSettings.current.seconds);

	const inheritedLabel = $derived(inherited === null ? 'no rest' : restLabel(inherited * 1000));

	const source = $derived(
		restSettings.current.overrides[group?.meta.id ?? ''] === undefined
			? `The ${inheritedLabel} default`
			: `This exercise’s own ${inheritedLabel}`
	);
</script>

<Sheet bind:open title={group === null ? 'Rest' : group.meta.name} description="Rest in this plan">
	<div class="flex flex-col gap-3 pt-1">
		<Switch
			label="Rest after this exercise"
			description={rests
				? 'A countdown starts when a working set is logged'
				: 'No countdown. Not timed in this plan'}
			bind:checked={() => rests, (next) => onchange(next ? shown : null)}
		/>

		{#if rests}
			<RestDurationField
				label="Duration"
				description={planned === undefined ? source : 'This plan only'}
				seconds={shown}
				onchange={(next) => onchange(next)}
			/>
		{/if}

		{#if planned !== undefined}
			<Button variant="secondary" onclick={() => onchange(undefined)}>
				Use the default ({inheritedLabel})
			</Button>
		{/if}
	</div>
</Sheet>
