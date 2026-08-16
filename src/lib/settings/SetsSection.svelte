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

	let { userId }: { userId: string | null } = $props();

	async function chooseScale(next: string) {
		if (next !== 'rpe' && next !== 'rir') {
			return;
		}

		await exertionScale.choose(await getStore(), next);

		if (userId !== null) {
			syncSoon(userId);
		}
	}

	async function chooseRest(patch: Partial<RestDefaultPreference>) {
		await restSettings.setDefault(await getStore(), patch);

		if (userId !== null) {
			syncSoon(userId);
		}
	}
</script>

<Section title="Sets">
	<li>
		<ListRow title="Rating scale" weight="bold" description="The same set reads RPE 8 or RIR 2">
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
</Section>
