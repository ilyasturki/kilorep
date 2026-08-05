<script lang="ts">
	import Section from '$lib/settings/Section.svelte';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import { getStore } from '$lib/store/store';
	import { syncSoon } from '$lib/sync/client';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';

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

	{#snippet footer()}
		<p class="text-sm text-pretty text-ink-muted">
			The same set reads <span class="font-bold text-ink">RPE 8</span>
			or <span class="font-bold text-ink">RIR 2</span>.
		</p>
	{/snippet}
</Section>
