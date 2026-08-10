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

	/**
	 * The plan's rest for one exercise, in the three states it has — the exercise
	 * detail screen's pair of controls, asking the narrower question.
	 *
	 * A sheet rather than a row on the card: this is set once when the plan is
	 * written and inherited the rest of the time, and a stepper on every card for
	 * a value most cards never disagree with would double the controls in the
	 * pane to say nothing new. The card prints a line when it *does* disagree,
	 * which is the case worth a glance.
	 *
	 * Nothing here is written to the exercise. What the plan says stays inside
	 * the plan: setting Sunday's squats to three minutes must not retune every
	 * other session that ever squats.
	 */
	const planned = $derived(group?.exercise.restSeconds);

	/** What this exercise would rest at if the plan said nothing — see `restSecondsOf`. */
	const inherited = $derived(
		group === null
			? restSettings.current.seconds
			: restSecondsFor(group.meta.id, restSettings.current)
	);

	const effective = $derived(planned === undefined ? inherited : planned);

	const rests = $derived(effective !== null);

	// The number the switch turns back on, for the case where the effective
	// answer is never-rest and there is no duration on screen to reuse.
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

		<!-- Only once the plan has an opinion of its own: with nothing to take
		     back, a button offering to take it back is a control that does
		     nothing. Same shape, and the same sentence, as the exercise screen's. -->
		{#if planned !== undefined}
			<Button variant="secondary" onclick={() => onchange(undefined)}>
				Use the default ({inheritedLabel})
			</Button>
		{/if}
	</div>
</Sheet>
