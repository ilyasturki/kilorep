<script lang="ts">
	import { weightStep } from '$lib/domain/exercise';
	import { REST_NUDGE_SECONDS } from '$lib/domain/rest';
	import type { Arms, SetCursor } from '$lib/domain/workout';
	import { loadUnitLabel } from '$lib/exercises/label';
	import Card from '$lib/styleguide/Card.svelte';
	import Frame from '$lib/styleguide/Frame.svelte';
	import Spec from '$lib/styleguide/Spec.svelte';
	import { bench, incline, liveWorkout, sessionHistory } from '$lib/styleguide/fixtures';
	import Button from '$lib/ui/Button.svelte';
	import { caption } from '$lib/styleguide/chrome';
	import ActiveSet from '$lib/workout/ActiveSet.svelte';
	import ArmsField from '$lib/workout/ArmsField.svelte';
	import EntryStack from '$lib/workout/EntryStack.svelte';
	import ExerciseBlock from '$lib/workout/ExerciseBlock.svelte';
	import GripField from '$lib/workout/GripField.svelte';
	import LiveLedger from '$lib/workout/LiveLedger.svelte';
	import LiveTray from '$lib/workout/LiveTray.svelte';
	import RestBar from '$lib/workout/RestBar.svelte';
	import RestPill from '$lib/workout/RestPill.svelte';
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
	const blockWorkout = $state(liveWorkout());

	const cursorsOf = (workout: typeof trayWorkout, entry = 0) =>
		entriesWithMeta(workout, catalogById)[entry];

	const trayEntry = $derived(cursorsOf(trayWorkout));
	const blockEntry = $derived(cursorsOf(blockWorkout));
	const ledgerEntries = $derived(entriesWithMeta(ledgerWorkout, catalogById));

	// The third set — warmup logged, two working sets in, this is the one being stood over.
	const trayCursor = $derived<SetCursor | null>(trayEntry.cursors[3] ?? null);

	let blockActive = $state<string | null>('bench-3');
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

		restTimer.start({ exerciseId: 'bench-press', seconds: 180 }, Date.now());
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
					count={4}
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

<Card name="LiveTray" note="ActiveSet docked to the bottom of the phone" tall>
	<Frame label="the tray as it sits on /train/live" canvas>
		<div class="relative h-[26rem]">
			<div class="absolute inset-x-0 bottom-0">
				<LiveTray
					cursor={trayCursor}
					meta={bench}
					note={null}
					count={4}
					history={sessionHistory}
					total={13}
					oncommit={noop}
					ondraft={noop}
					onrate={noop}
					{onoptions}
					onfinish={noop}
				/>
			</div>
		</div>
	</Frame>
</Card>

<Card name="ExerciseBlock" note="one exercise's sets, the phone's list" tall>
	<Frame label="EntryStack wraps it — the accent rail marks a superset">
		<div class="relative flex flex-col gap-5 p-3">
			<EntryStack legs={blockEntry.legs} superset={blockEntry.superset}>
				{#snippet leg(leg)}
					<ExerciseBlock
						meta={leg.meta}
						grip={leg.grip}
						cursors={leg.cursors}
						history={sessionHistory}
						activeSetId={blockActive}
						onselect={(setId) => (blockActive = setId)}
						onquick={noop}
						onadd={noop}
						oninsert={noop}
						onoptions={(_, anchor) => onoptions(anchor)}
						onexercise={onoptions}
					/>
				{/snippet}
			</EntryStack>
		</div>
	</Frame>
</Card>

<Card name="SwipeRow" note="a logged set — swipe to quick-log, hold for options">
	<Frame label="the row ExerciseBlock is built from">
		<div class="flex flex-col gap-1 p-3">
			<SwipeRow
				status="done"
				index={1}
				weight={82.5}
				reps={8}
				right="RPE 8"
				onselect={noop}
				{onoptions}
			/>
			<SwipeRow
				status="pending"
				index={3}
				weight={null}
				reps={null}
				right="82.5 × 7"
				quick={{ weight: 82.5, reps: 7 }}
				onselect={noop}
				onquick={noop}
				{onoptions}
			/>
		</div>
	</Frame>
	<span class={caption}>quick={'{'}…{'}'} — drag the second row right to log what it recalls</span>
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

<Card name="RestBar · RestPill" note="both read the one global restTimer">
	<Spec label="press to start a 3:00 rest — the bar docks, the pill rides the chrome" full>
		<Button variant="secondary" onclick={toggleRest}>
			{resting ? 'Stop the timer' : 'Start a rest'}
		</Button>
	</Spec>
	<Frame label="RestBar — full width, +{REST_NUDGE_SECONDS}s per tap">
		<div class="min-h-16 p-2"><RestBar /></div>
	</Frame>
	<Frame label="RestPill — the same timer, folded into a bar button">
		<div class="flex min-h-16 items-center p-2"><RestPill /></div>
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
