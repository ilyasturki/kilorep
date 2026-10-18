<script lang="ts">
	import { weightStep } from '$lib/domain/exercise';
	import type { Arms, SetCursor } from '$lib/domain/workout';
	import { loadUnitLabel, setFigures } from '$lib/exercises/label';
	import Card from '$lib/styleguide/Card.svelte';
	import Frame from '$lib/styleguide/Frame.svelte';
	import Spec from '$lib/styleguide/Spec.svelte';
	import {
		bench,
		incline,
		liveWorkout,
		sessionHistory,
		supersetWorkout
	} from '$lib/styleguide/fixtures';
	import Button from '$lib/ui/Button.svelte';
	import { caption } from '$lib/styleguide/chrome';
	import ActiveSet from '$lib/workout/ActiveSet.svelte';
	import ArmsField from '$lib/workout/ArmsField.svelte';
	import ExerciseBlock from '$lib/workout/ExerciseBlock.svelte';
	import GripField from '$lib/workout/GripField.svelte';
	import LiveLedger from '$lib/workout/LiveLedger.svelte';
	import LiveTray from '$lib/workout/LiveTray.svelte';
	import RestChip from '$lib/workout/RestChip.svelte';
	import SwipeRow from '$lib/workout/SwipeRow.svelte';
	import { entriesWithMeta } from '$lib/workout/groups';
	import { restTimer } from '$lib/workout/rest.svelte';
	import { catalogById } from '$lib/catalog';

	type Props = { onoptions: (anchor: HTMLElement) => void };

	let { onoptions }: Props = $props();

	// Each specimen gets its own session: logging a set in the tray must not move the set the
	// ledger beside it is pointing at, or two cards would be arguing about the same afternoon.
	const trayWorkout = $state(liveWorkout());
	const ledgerWorkout = $state(liveWorkout());
	const blockWorkout = $state(supersetWorkout());

	const cursorsOf = (workout: typeof trayWorkout, entry = 0) =>
		entriesWithMeta(workout, catalogById)[entry];

	const trayEntry = $derived(cursorsOf(trayWorkout));
	const blockEntries = $derived(entriesWithMeta(blockWorkout, catalogById).slice(0, 3));
	const ledgerEntries = $derived(entriesWithMeta(ledgerWorkout, catalogById));

	// The third set — warmup logged, two working sets in, this is the one being stood over.
	const trayCursor = $derived<SetCursor | null>(trayEntry.cursors[3] ?? null);

	let blockActive = $state<string | null>('pecdeck-2');
	let ledgerActive = $state<string | null>('bench-3');

	const step = (from: number, direction: number) => weightStep(bench.equipment, from, direction);

	let grip = $state<string | undefined>('standard');
	let arms = $state<Arms>('both');

	let resting = $state(false);

	function toggleRest() {
		if (resting) {
			restTimer.clear();
			resting = false;

			return;
		}

		restTimer.reset();
		restTimer.start({ exerciseId: 'bench-press', seconds: 180, name: 'Bench Press' }, Date.now());
		resting = true;
	}

	// There is no session behind the sheet, so a specimen's callback has nowhere to write a set.
	// Swallowed on purpose — returning the arguments is what keeps it a real function rather
	// than an empty one.
	const noop = (...args: unknown[]) => args;

	// The ActiveSet card names the last handler it reached instead, because which gesture calls
	// which callback is the half of a component's behaviour a still specimen cannot show. Only
	// that card writes it: a readout fed by every card on the page would report the wrong one.
	let fired = $state<string | null>(null);

	let trayOpen = $state(true);

	const say =
		(name: string) =>
		(...args: unknown[]) => {
			const shown = args.filter((arg) => typeof arg === 'number' || typeof arg === 'string');

			fired = shown.length === 0 ? name : `${name}(${shown.join(', ')})`;
		};
</script>

<Card name="ActiveSet" note="the docked set — stepper, exertion, commit" tall>
	<Frame label="phone width — the tray's contents without the tray">
		<div class="p-3">
			{#if trayCursor !== null}
				<ActiveSet
					cursor={trayCursor}
					history={sessionHistory}
					meta={bench}
					note={null}
					{step}
					unit={loadUnitLabel(bench)}
					oncommit={say('oncommit')}
					ondraft={say('ondraft')}
					onrate={say('onrate')}
					{onoptions}
				/>
			{/if}
		</div>
	</Frame>
	<span class={caption}>the numbers are live — step them, rate the set, press the check</span>
	<span class="text-sm font-bold tracking-numeral text-ink-muted">
		last callback: {fired ?? 'none yet'}
	</span>
</Card>

<Card name="LiveTray" note="ActiveSet as a drawer over the bottom of the phone" tall>
	<Frame
		label="drag the handle down; a tap on it never lowers — lowered, tap or drag the peek"
		canvas
	>
		<div class="relative h-[26rem] overflow-hidden">
			<LiveTray
				bind:open={trayOpen}
				cursor={trayCursor}
				meta={bench}
				note={null}
				history={sessionHistory}
				total={13}
				oncommit={noop}
				ondraft={noop}
				onrate={noop}
				{onoptions}
				onfinish={noop}
			/>
		</div>
	</Frame>
	<span class={caption}>
		it stands over the list rather than beside it — lowered, it slides down to a peek of its handle,
		and what it uncovers was already there
	</span>
	<Button variant="chrome" caps disabled={trayOpen} onclick={() => (trayOpen = true)}>
		RAISE THE TRAY
	</Button>
</Card>

<Card name="ExerciseBlock" note="one entry's sets, the phone's list" tall>
	<Frame label="a lone exercise, then a superset: one heading, rounds interleaved, lettered marks">
		<div class="flex flex-col gap-5 p-3">
			{#each blockEntries as entry (entry.id)}
				{#if entry.id !== 'entry-2'}
					<ExerciseBlock
						legs={entry.legs}
						cursors={entry.cursors}
						history={sessionHistory}
						activeSetId={blockActive}
						onselect={(setId) => (blockActive = setId)}
						onquick={noop}
						onadd={noop}
						oninsert={noop}
						onoptions={(_, anchor) => onoptions(anchor)}
						onexercise={(_, anchor) => onoptions(anchor)}
					/>
				{/if}
			{/each}
		</div>
	</Frame>
	<span class={caption}>
		a superset's names are each a leg's menu; its add row adds a round, a set on every leg
	</span>
</Card>

<Card name="SwipeRow" note="a set — swipe to log or remove, hold for options">
	<Frame label="the rows ExerciseBlock is built from">
		<div class="m-3 list-group">
			<SwipeRow
				status="done"
				index={1}
				figures={setFigures(bench, 82.5, 8)}
				right="RPE 8"
				onselect={noop}
				onunlog={noop}
				onremove={noop}
				{onoptions}
			/>
			<SwipeRow
				status="done"
				index={2}
				figures={setFigures(bench, 82.5, 7)}
				selected
				right="Editing"
				onselect={noop}
				onunlog={noop}
				onremove={noop}
				{onoptions}
			/>
			<SwipeRow
				status="pending"
				index={3}
				figures={setFigures(bench, 82.5, 7)}
				quick={{ weight: 82.5, reps: 7 }}
				onselect={noop}
				onquick={noop}
				onremove={noop}
				{onoptions}
			/>
			<SwipeRow
				status="done"
				index={1}
				figures={setFigures(catalogById['pull-up'], 10, 6)}
				right="Logged"
				onselect={noop}
				{onoptions}
			/>
			<SwipeRow
				status="pending"
				index={2}
				figures={setFigures(catalogById['pull-up'], 0, 8)}
				onselect={noop}
				{onoptions}
			/>
		</div>
	</Frame>
	<span class={caption}>
		selected — a logged set being edited · the body-weight rows add what was on the belt, or read
		reps alone
	</span>
	<span class={caption}>
		drag a row right to log or unlog, left to remove: past the point where letting go goes through,
		Log lights up and Remove turns solid, with one tick each way
	</span>
</Card>

<Card name="LiveLedger" note="the desktop's whole session, one table" wide tall>
	<Frame
		label="desktop column — rows reorder by their grip; scroll it sideways on a phone"
		size="column"
		floor={1140}
	>
		<div class="p-4">
			<LiveLedger
				entries={ledgerEntries}
				history={sessionHistory}
				activeSetId={ledgerActive}
				onselect={(setId) => (ledgerActive = setId)}
				onquick={noop}
				oncommit={noop}
				ondraft={noop}
				onrate={noop}
				onadd={noop}
				oninsert={noop}
				onoptions={(_, anchor) => onoptions(anchor)}
				onexercise={(_, anchor) => onoptions(anchor)}
				onreorder={noop}
			/>
		</div>
	</Frame>
</Card>

<Card name="RestChip" note="the rest's one face, in the top bar on every tab">
	<Spec label="start a 3:00 rest, then tap the chip for −30 / +30, SKIP and rest off" full>
		<Button variant="secondary" onclick={toggleRest}>
			{resting ? 'Stop the timer' : 'Start a rest'}
		</Button>
	</Spec>
	<Frame label="running, then skipped (REST brings it back), then off (tap to turn it on)">
		<div class="flex min-h-16 items-center justify-end p-2"><RestChip /></div>
	</Frame>
</Card>

<Card name="GripField · ArmsField" note="the two axes a set is stamped with">
	<Spec label="grips come off the exercise — bench has Standard and Close" full>
		<GripField meta={bench} value={grip} onpick={(next) => (grip = next)} />
	</Spec>
	<Spec label="recorded, never counted toward the set total" full>
		<ArmsField value={arms} onpick={(next) => (arms = next)} />
	</Spec>
	<span class={caption}>
		{incline.name} is per-hand, so its sets carry the arm the load was on
	</span>
</Card>
