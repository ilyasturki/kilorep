<script lang="ts">
	import AppBar from '$lib/nav/AppBar.svelte';
	import BackLink from '$lib/nav/BackLink.svelte';
	import { createAppBarSlot } from '$lib/nav/bar.svelte';
	import Section from '$lib/settings/Section.svelte';
	import RestDurationField from '$lib/settings/RestDurationField.svelte';
	import Card from '$lib/styleguide/Card.svelte';
	import Frame from '$lib/styleguide/Frame.svelte';
	import Spec from '$lib/styleguide/Spec.svelte';
	import { caption, chromeButton } from '$lib/styleguide/chrome';
	import Badge from '$lib/ui/Badge.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import MiniStepper from '$lib/ui/MiniStepper.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import TipButton from '$lib/ui/TipButton.svelte';
	import Archive from '$lib/ui/icons/Archive.svelte';

	// The bar reads its title out of context rather than a prop, so the sheet has to stand in
	// for the layout that normally provides it.
	const slot = createAppBarSlot();

	slot.title = 'Bench Press';

	let rest = $state(180);
	let warmupRest = $state(60);
	let sync = $state(false);
	let plates = $state(4);
</script>

<Card name="AppBar" note="phone: back · title. lg: back · tabs · action" wide>
	<Frame label="the real bar — below lg it is a title, at lg the tabs move into it" size="column">
		<AppBar />
	</Frame>
	<span class={caption}>
		title, leading and action come from the page through `fillAppBar` — never as props
	</span>
	<span class={caption}>
		its breakpoint is the viewport, not this frame: narrow the window to see the phone's title bar
	</span>
</Card>

<Card name="BackLink" note="walks up the hierarchy, never back through time">
	<div class="flex flex-wrap items-center gap-4">
		<Spec label={`href="/plan/templates"`}>
			<BackLink href="/plan/templates" label="Back" />
		</Spec>
		<Spec label="a plain anchor — cmd-click opens the parent">
			<BackLink href="/dev/ui" label="Back" />
		</Spec>
	</div>
</Card>

<Card
	name="settings/Section"
	note="a titled group of rows, with an optional action and footer"
	tall
>
	<Frame label="the shape every block on /settings takes">
		<div class="flex flex-col gap-6 p-3">
			<Section title="Session">
				{#snippet action()}
					<TipButton label="Archive" onclick={() => {}} class={chromeButton}>
						<Archive size={20} />
					</TipButton>
				{/snippet}

				<div class="list-group">
					<ListRow title="Exertion scale" meta="RPE" onclick={() => {}} />
					<ListRow title="Units" meta="kg" onclick={() => {}} />
				</div>

				{#snippet footer()}
					<span>Applies to sets logged from now on.</span>
				{/snippet}
			</Section>

			<Section title="Server">
				<div class="flex flex-col">
					<Switch label="Sync with server" bind:checked={sync} />
					<ListRow title="Last synced" meta="Never">
						{#snippet trailing()}<Badge tone="neutral">Offline</Badge>{/snippet}
					</ListRow>
				</div>
			</Section>
		</div>
	</Frame>
	<span class={caption}>
		SyncRow and ServerSection read the sync store directly, so they are shown on /settings itself
	</span>
</Card>

<Card name="RestDurationField" note="a compact StepperField, counting in a clock’s units">
	<Frame label="a rest that can be turned off entirely">
		<div class="flex flex-col gap-3 p-3">
			<RestDurationField
				label="Between sets"
				description="Counts down from the moment a set is logged"
				seconds={rest}
				onchange={(next) => (rest = next)}
			/>
			<RestDurationField
				label="After a warmup"
				seconds={warmupRest}
				disabled={!sync}
				onchange={(next) => (warmupRest = next)}
			/>
		</div>
	</Frame>
	<span class={caption}>
		tap the number and type it — 2 3 0 is 2:30, and the pad never needs a colon. the second is
		disabled — flip "Sync with server" above to wake it
	</span>
</Card>

<Card name="MiniStepper" note="two arms around a value that is not a number">
	<Spec label="ondec / oninc — null on either side disables that arm" full>
		<MiniStepper
			label="Plates per side"
			value="{plates} × 20 kg"
			ondec={plates > 0 ? () => (plates -= 1) : null}
			oninc={plates < 6 ? () => (plates += 1) : null}
		/>
	</Spec>
	<Spec label="dim — the value is a default nobody has set" full>
		<MiniStepper label="Rest" value="Off" dim ondec={null} oninc={() => {}} />
	</Spec>
</Card>
