<script lang="ts">
	import type { RestDefaultPreference } from '$lib/domain/preference';
	import Section from '$lib/settings/Section.svelte';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import { restSettings } from '$lib/settings/rest.svelte';
	import RestDurationField from '$lib/settings/RestDurationField.svelte';
	import { getStore } from '$lib/store/store';
	import { syncSoon } from '$lib/sync/client';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Switch from '$lib/ui/Switch.svelte';

	/**
	 * First on the page, and above the account: the only section here that
	 * answers to the gym rather than to plumbing, and the only one that exists
	 * whether or not a server was ever connected.
	 */
	let { userId }: { userId: string | null } = $props();

	/**
	 * The rating's name, written to the holder and to the record behind it.
	 *
	 * The chips are a `single` toggle group, so a tap on the lit one answers with
	 * an empty string — which here would mean "no scale at all", a state nothing
	 * downstream can render. Ignored rather than guarded against in the markup:
	 * the group is a choice between two, and re-tapping the chosen one is a
	 * no-op by intent.
	 *
	 * `syncSoon` because a preference is a record like any other, and taste that
	 * only reached one device is worse than none.
	 */
	async function chooseScale(next: string) {
		if (next !== 'rpe' && next !== 'rir') {
			return;
		}

		await exertionScale.choose(await getStore(), next);

		if (userId !== null) {
			syncSoon(userId);
		}
	}

	/**
	 * Rest's permanent answer. PRODUCT.md let the feature back in on the
	 * condition that it can be switched off, and this is the switch — off means
	 * no bar, no scheduling and no notification, not a timer running quietly.
	 *
	 * The duration below it stays visible while it is off. A switch that hides
	 * the thing it governs makes the user turn a feature on to find out what they
	 * are turning on, and the field is one row.
	 */
	async function chooseRest(patch: Partial<RestDefaultPreference>) {
		await restSettings.setDefault(await getStore(), patch);

		if (userId !== null) {
			syncSoon(userId);
		}
	}
</script>

<Section title="Sets">
	<li>
		<ListRow title="Rating scale">
			{#snippet trailing()}
				<ChipGroup
					bind:value={() => exertionScale.current, (next) => void chooseScale(next)}
					layout="line"
					label="Rating scale"
				>
					<Chip value="rpe">RPE</Chip>
					<Chip value="rir">RIR</Chip>
				</ChipGroup>
			{/snippet}
		</ListRow>
	</li>

	<!-- Both controls carry their own label and description and lay themselves
	     out as a full-width row, so they sit in the `<li>` directly rather than
	     inside a `ListRow` that would print the name a second time. The padding
	     is `ListRow`'s own, so they part from the row above on the same line. -->
	<li class="min-h-row px-3 py-2">
		<Switch
			label="Rest timer"
			description="Starts when you log a working set"
			bind:checked={
				() => restSettings.current.enabled, (next) => void chooseRest({ enabled: next })
			}
		/>
	</li>

	<li class="min-h-row px-3 py-2">
		<RestDurationField
			label="Default rest"
			description="Unless the exercise says otherwise"
			seconds={restSettings.current.seconds}
			disabled={!restSettings.current.enabled}
			onchange={(next) => void chooseRest({ seconds: next })}
		/>
	</li>

	{#snippet footer()}
		<p class="text-sm text-pretty text-ink-muted">
			The same set reads <span class="font-bold text-ink">RPE 8</span>
			or <span class="font-bold text-ink">RIR 2</span>.
		</p>

		<p class="text-sm text-pretty text-ink-muted">
			Rest counts down when you log a working set — never after a warmup, and once per round in a
			superset. It runs at the foot of the app rather than on a screen of its own, and the phone is
			notified when it ends. An exercise can carry its own duration; that lives on the exercise.
		</p>
	{/snippet}
</Section>
