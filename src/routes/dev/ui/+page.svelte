<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import type { SetStatus } from '$lib/ui/SetMark.svelte';
	import AddRow from '$lib/ui/AddRow.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import DatePicker from '$lib/ui/DatePicker.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ExertionPicker from '$lib/ui/ExertionPicker.svelte';
	import Input from '$lib/ui/Input.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Menu from '$lib/ui/Menu.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import { HOLD_MS, press, SLOP } from '$lib/ui/press';
	import SearchField from '$lib/ui/SearchField.svelte';
	import Segmented from '$lib/ui/Segmented.svelte';
	import Select from '$lib/ui/Select.svelte';
	import SetMark from '$lib/ui/SetMark.svelte';
	import SetRow from '$lib/ui/SetRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import Textarea from '$lib/ui/Textarea.svelte';
	import TipButton from '$lib/ui/TipButton.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import Archive from '$lib/ui/icons/Archive.svelte';
	import ArrowsLeftRight from '$lib/ui/icons/ArrowsLeftRight.svelte';
	import Backspace from '$lib/ui/icons/Backspace.svelte';
	import Barbell from '$lib/ui/icons/Barbell.svelte';
	import BarbellFill from '$lib/ui/icons/BarbellFill.svelte';
	import Books from '$lib/ui/icons/Books.svelte';
	import Calendar from '$lib/ui/icons/Calendar.svelte';
	import Cards from '$lib/ui/icons/Cards.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import Eye from '$lib/ui/icons/Eye.svelte';
	import Info from '$lib/ui/icons/Info.svelte';
	import ListBullets from '$lib/ui/icons/ListBullets.svelte';
	import MagnifyingGlass from '$lib/ui/icons/MagnifyingGlass.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import Play from '$lib/ui/icons/Play.svelte';
	import PlayFill from '$lib/ui/icons/PlayFill.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	// An overview of the component library: one card per component, everything
	// live. A card is titled with the component it renders and every instance
	// carries the prop that makes it that instance, so the page can be read as
	// the API rather than as a mock screen. Tokens and the type scale are not
	// here — src/app.css names them and holds the reasoning.

	// The page's own furniture. Written out rather than composed at runtime:
	// Tailwind scans source text, so an arbitrary property it has not seen
	// spelled out in full is never emitted.
	const card = 'flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-4';
	const caption = 'text-xs font-extrabold text-ink-faint';
	const tile = 'grid size-8 place-items-center text-ink-muted';
	// One instance and the prop that names it.
	const specimen = 'flex flex-col items-start gap-1.5';
	// The round icon button the template editor's chrome wears, borrowed so the
	// TipButton card demonstrates the real thing rather than a shape near it.
	const chromeButton =
		'grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border border-line ' +
		'text-ink-muted focus-ring hover:bg-hover press:bg-surface-2';

	// `as const` so each `variant` is the literal Button expects, not `string`.
	const outlined = [
		{ variant: 'secondary', label: 'Add note' },
		{ variant: 'destructive', label: 'Clear' },
		{ variant: 'chrome', label: 'Reopen' }
	] as const;

	// Typed, so a mistyped status is a compile error rather than a silent cast.
	const marks: { status: SetStatus; index?: number }[] = [
		{ status: 'done' },
		{ status: 'active', index: 3 },
		{ status: 'pending', index: 4 },
		{ status: 'warmup' }
	];

	// `prop` is spelled out rather than derived from `step`, so the caption
	// reads as the Svelte one would write at the call site, braces and all.
	//
	// `value` is state and `recalled` is not: the field is controlled, so the
	// specimen has to hold the value for the arms to move it, and the dot has to
	// have a fixed thing to be measured against.
	const steppers = $state([
		{
			value: 82.5 as number | null,
			recalled: 82.5,
			label: 'kg',
			step: 2.5,
			ruler: false,
			prop: 'step={2.5}'
		},
		{
			value: 7 as number | null,
			recalled: 7,
			label: 'reps',
			step: 1,
			ruler: false,
			prop: 'step={1}'
		},
		{
			value: 100 as number | null,
			recalled: 100,
			label: 'kg',
			step: 2.5,
			ruler: true,
			prop: 'ruler (touch only)'
		}
	]);

	const exercises = [
		{ name: 'Bench Press (Barbell)', meta: '4 sets · rest 3:00', count: '4/4', current: false },
		{ name: 'Incline Dumbbell Press', meta: '4 sets · rest 2:00', count: '1/4', current: true },
		{
			name: 'Cable Fly + Lateral Raise',
			meta: 'superset · 3 rounds · rest 1:30',
			count: '0/6',
			current: false
		}
	];

	const equipmentItems = [
		{ value: 'barbell', label: 'Barbell' },
		{ value: 'dumbbell', label: 'Dumbbell' },
		{ value: 'cable', label: 'Cable' },
		{ value: 'machine', label: 'Machine' },
		{ value: 'bodyweight', label: 'Bodyweight' },
		{ value: 'kettlebell', label: 'Kettlebell' },
		{ value: 'band', label: 'Resistance band', disabled: true }
	];

	const muscleItems = [
		{ value: 'chest', label: 'Chest' },
		{ value: 'back', label: 'Back' },
		{ value: 'shoulders', label: 'Shoulders' },
		{ value: 'biceps', label: 'Biceps' },
		{ value: 'triceps', label: 'Triceps' },
		{ value: 'quads', label: 'Quads' },
		{ value: 'hamstrings', label: 'Hamstrings' },
		{ value: 'glutes', label: 'Glutes' },
		{ value: 'calves', label: 'Calves' },
		{ value: 'core', label: 'Core' }
	];

	const badges = [
		{ tone: 'neutral', label: 'Warmup' },
		{ tone: 'accent', label: 'Superset' },
		{ tone: 'danger', label: 'Failed' }
	] as const;

	// The drag card's list. One row is deliberately taller than the rest — the
	// drag measures each row's own height at lift, and a list that happened to
	// be uniform would showcase nothing about that.
	type DragItem = { id: string; name: string; meta: string; note?: string };

	const dragItems = $state<DragItem[]>([
		{ id: 'bench', name: 'Bench Press (Barbell)', meta: 'Chest · barbell' },
		{ id: 'incline', name: 'Incline Dumbbell Press', meta: 'Chest · dumbbell' },
		{
			id: 'row',
			name: 'Bent-Over Row',
			meta: 'Back · barbell',
			note: 'a third line, so this row is taller on purpose'
		},
		{ id: 'press', name: 'Overhead Press', meta: 'Shoulders · barbell' }
	]);

	const dragList = new DragOrder({
		order: () => dragItems.map((item) => item.id),
		move: (id, index) => {
			const from = dragItems.findIndex((item) => item.id === id);

			if (from === -1 || from === index) {
				return false;
			}

			const [item] = dragItems.splice(from, 1);

			dragItems.splice(index, 0, item);

			return true;
		}
	});

	// The same reduced-motion split the real lists make: the row in hand keeps
	// following the finger, the displaced rows stop sliding.
	const dragSlide = $derived(prefersReducedMotion.current ? 0 : 200);

	let setType = $state('normal');
	// The stored value, always RPE — the two specimens below share it, which is
	// how the page shows that RIR is a label and not a second field.
	let rpe = $state<number | null>(8);
	let overviewOpen = $state(false);
	let optionsOpen = $state(false);

	// One Menu instance addressed by whichever ⋯ asked, the way every screen
	// holds one — the SetRow specimens and the Menu card all open it, so the
	// gallery answers the gesture the way the app does.
	let menuOpen = $state(false);
	let menuAnchor = $state<HTMLElement | null>(null);

	function openMenu(anchor: HTMLElement) {
		menuAnchor = anchor;
		menuOpen = true;
	}

	let exerciseName = $state('Bench Press (Barbell)');
	let note = $state('');
	let query = $state('');
	let equipment = $state('dumbbell');
	let muscles = $state(['chest', 'triceps']);
	let chipMuscles = $state(['chest']);
	// Buttons here, not links: the Plan layout passes an `href` per segment and
	// lets the route own the value, which on this page would navigate off it.
	// Everything else about the two is the same control.
	let half = $state('templates');
	const halves = [
		{ value: 'templates', label: 'Templates', icon: Cards },
		{ value: 'exercises', label: 'Exercises', icon: Books }
	];
	let date = $state(today(getLocalTimeZone()));
	let keepAwake = $state(true);
	let syncEnabled = $state(false);
	let deleteOpen = $state(false);
	// The card reports what the confirm actually did, so the dialog can be
	// checked for the thing it is for rather than for opening prettily.
	let deleted = $state(false);
</script>

<svelte:head><title>Components | Kilorep</title></svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && dragList.cancel()} />

<!-- The two ChipGroups. Shown twice — standalone and inside the options sheet —
     and the point of the page is that they are the same thing. `annotated` is
     what differs: the card names the props, the sheet is the real screen. -->
{#snippet pickers(annotated: boolean)}
	<div class="flex items-baseline gap-2">
		<h3 class="label-caps">Set type</h3>
		{#if annotated}<span class={caption}>layout="grid"</span>{/if}
	</div>
	<ChipGroup bind:value={setType} layout="grid" label="Set type">
		<Chip value="normal">Normal</Chip>
		<Chip value="warmup">Warmup</Chip>
		<Chip value="drop">Drop</Chip>
		<Chip value="fail">Fail</Chip>
	</ChipGroup>
	<div class="flex items-baseline gap-2">
		<h3 class="label-caps">Exertion</h3>
		{#if annotated}<span class={caption}>collapsed · chips · Other</span>{/if}
	</div>
	<!-- The real control rather than a row of chips standing in for one: what the
	     rungs are, how the row collapses and where an off-ladder value is entered
	     are the component's business now, and a specimen restating them by hand
	     would be the first thing to go stale. Both scales are shown because the
	     conversion is the part worth being able to eyeball. -->
	<div class="flex flex-col gap-2">
		<ExertionPicker value={rpe} scale="rpe" onchange={(next) => (rpe = next)} />
		<ExertionPicker value={rpe} scale="rir" onchange={(next) => (rpe = next)} />
	</div>
{/snippet}

<div class="min-h-dvh bg-canvas px-6 pt-safe-t pb-16 text-ink">
	<div class="mx-auto flex max-w-[1280px] flex-col gap-6 pt-6">
		<!-- A bento, not a terrace. Cards vary wildly in height — the numpad is three
		     times the badge card — so the five tallest take row-span-2 and the flow is
		     dense, which lets a later short card backfill the cell a tall one skipped
		     past. Rows then differ little enough that the default stretch is affordable:
		     every card fills its cell, so the grid reads flush instead of leaving a hole
		     under each short one. The spans are inert at one column, so the phone
		     layout is untouched. -->
		<div
			class="grid grid-flow-row-dense [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-4"
		>
			<article class={card}>
				<h2 class="label-caps">Button</h2>
				<div class={specimen}>
					<Button variant="commit" class="w-full">82.5 × 7</Button>
					<span class={caption}>variant="commit"</span>
				</div>
				<div class={specimen}>
					<Button variant="raised" class="w-full">+ New template</Button>
					<span class={caption}>variant="raised" — surface-filled, for a row on the canvas</span>
				</div>
				<div class="flex flex-wrap gap-x-4 gap-y-3">
					{#each outlined as button (button.variant)}
						<div class={specimen}>
							<Button variant={button.variant}>{button.label}</Button>
							<span class={caption}>variant="{button.variant}"</span>
						</div>
					{/each}
				</div>
			</article>

			<!-- The one card that cannot be read, only pressed. Everything here is
			     invisible on a mouse: `press:` falls back to `:active`, the sink is
			     coarse-only, and the hold is a touch gesture with `contextmenu` as
			     its desk stand-in. Open it on a phone, or with device emulation on. -->
			<article class={card}>
				<h2 class="label-caps">press</h2>

				<div class={specimen}>
					<button
						type="button"
						class="min-h-row w-full press-sink rounded-xl border border-line px-4 text-md
							font-bold text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
						{@attach press()}
					>
						Hold me — nothing happens
					</button>
					<span class={caption}>tint + sink, no `onhold`</span>
				</div>

				<div class={specimen}>
					<button
						type="button"
						class="min-h-row w-full press-sink rounded-xl border border-line px-4 text-md
							font-bold text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
						{@attach press(() => openMenu)}
					>
						Hold me — a menu opens
					</button>
					<span class={caption}>
						`onhold` — buzzes at {HOLD_MS}ms, cancels past {SLOP}px, eats the click
					</span>
				</div>
			</article>

			<article class="{card} row-span-2">
				<h2 class="label-caps">ChipGroup</h2>
				{@render pickers(true)}
				<div class="flex items-baseline gap-2">
					<h3 class="label-caps">Muscle targets</h3>
					<span class={caption}>type="multiple"</span>
				</div>
				<ChipGroup type="multiple" bind:value={chipMuscles} label="Muscle targets">
					{#each muscleItems.slice(0, 5) as muscle (muscle.value)}
						<Chip value={muscle.value}>{muscle.label}</Chip>
					{/each}
				</ChipGroup>
			</article>

			<article class={card}>
				<h2 class="label-caps">Segmented</h2>
				<Segmented bind:value={half} items={halves} label="Plan" />
				<span class={caption}>full width · `icon` per segment · arrow keys between them</span>
			</article>

			<article class={card}>
				<h2 class="label-caps">SetMark</h2>
				<div class="flex flex-wrap items-center gap-5">
					{#each marks as mark (mark.status)}
						<div class="flex flex-col items-center gap-1.5">
							<SetMark status={mark.status} index={mark.index} />
							<span class={caption}>status="{mark.status}"</span>
						</div>
					{/each}
				</div>
			</article>

			<article class="{card} row-span-2">
				<h2 class="label-caps">SetRow</h2>
				<div class="flex flex-col gap-2.5 rounded-xl bg-canvas p-3">
					<div class="flex flex-col gap-1">
						<span class={caption}>status="warmup"</span>
						<SetRow status="warmup" weight={20} reps={12} onoptions={openMenu}>
							{#snippet right()}warmup{/snippet}
						</SetRow>
					</div>
					<!-- `onselect` where `ExerciseBlock` passes it, and withheld from the
					     warmup where it withholds it: that prop is what decides whether a
					     row says it is tappable, so a showcase that never passed it would
					     display four states the screen never renders. -->
					<div class="flex flex-col gap-1">
						<span class={caption}>status="done"</span>
						<SetRow
							status="done"
							index={2}
							weight={85}
							reps={8}
							onselect={() => {}}
							onoptions={openMenu}
						>
							{#snippet right()}RPE 8{/snippet}
						</SetRow>
					</div>
					<div class="flex flex-col gap-1">
						<span class={caption}>status="active"</span>
						<SetRow status="active" index={3} weight={85} reps={8} onoptions={openMenu}>
							{#snippet right()}<span class="font-extrabold tracking-wider text-accent-text"
									>NOW</span
								>{/snippet}
						</SetRow>
					</div>
					<div class="flex flex-col gap-1">
						<span class={caption}>status="pending"</span>
						<SetRow status="pending" index={4} onselect={() => {}} onoptions={openMenu}>
							{#snippet right()}80 × 7{/snippet}
						</SetRow>
					</div>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">StepperField</h2>
				<div class="flex gap-2">
					{#each steppers as stepper (stepper.prop)}
						<div class="flex flex-1 flex-col gap-1.5">
							<StepperField
								bind:value={stepper.value}
								recalled={stepper.recalled}
								label={stepper.label}
								step={stepper.step}
								ruler={stepper.ruler}
							/>
							<span class={caption}>{stepper.prop}</span>
						</div>
					{/each}
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Sheet</h2>
				<div class="flex flex-wrap gap-x-4 gap-y-3">
					<div class={specimen}>
						<Button variant="secondary" onclick={() => (overviewOpen = true)}>
							<Stack size={20} /> Session overview
						</Button>
						<span class={caption}>title="Session"</span>
					</div>
					<div class={specimen}>
						<Button variant="secondary" onclick={() => (optionsOpen = true)}>Set options</Button>
						<span class={caption}>title="Set 3"</span>
					</div>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Menu</h2>
				<!-- The adaptive ⋯: a sheet under a thumb, a list anchored to the
				     button under a pointer. The SetRow specimens open the same
				     instance from their own ⋯. -->
				<div class={specimen}>
					<button
						type="button"
						aria-label="Exercise options"
						onclick={(e) => openMenu(e.currentTarget)}
						class="grid min-h-chrome w-11 place-items-center rounded-full text-ink-muted
							focus-ring hover:bg-hover press:bg-surface-2"
						{@attach press()}
					>
						<More size={20} />
					</button>
					<span class={caption}>anchor = the ⋯ that asked</span>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Input</h2>
				<div class={specimen}>
					<Input label="Exercise" bind:value={exerciseName} class="w-full" />
					<span class={caption}>label="Exercise"</span>
				</div>
				<div class={specimen}>
					<Input
						label="Exercise"
						value="Bench Press (Barbell)"
						error="Already in your exercises"
						class="w-full"
					/>
					<span class={caption}>error="…"</span>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Textarea</h2>
				<div class={specimen}>
					<Textarea
						label="Note"
						bind:value={note}
						placeholder="left shoulder tight"
						class="w-full"
					/>
					<span class={caption}>rows={3}</span>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">SearchField</h2>
				<div class={specimen}>
					<SearchField label="Search exercises" bind:value={query} class="w-full" />
					<span class={caption}>label is the accessible name, not a heading</span>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Select</h2>
				<div class={specimen}>
					<Select label="Equipment" items={equipmentItems} bind:value={equipment} class="w-full" />
					<span class={caption}>type="single"</span>
				</div>
				<div class={specimen}>
					<Select
						label="Muscle targets"
						items={muscleItems}
						bind:value={muscles}
						type="multiple"
						class="w-full"
					/>
					<span class={caption}>type="multiple"</span>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">DatePicker</h2>
				<div class={specimen}>
					<DatePicker label="Date" bind:value={date} maxToday class="w-full" />
					<span class={caption}>maxToday</span>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Switch</h2>
				<div class="flex flex-col">
					<Switch
						label="Keep screen awake"
						description="During an active workout"
						bind:checked={keepAwake}
					/>
					<span class={caption}>description="…"</span>
				</div>
				<div class="flex flex-col">
					<Switch label="Sync with server" bind:checked={syncEnabled} />
					<span class={caption}>label only</span>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Badge</h2>
				<div class="flex flex-wrap items-center gap-5">
					{#each badges as badge (badge.tone)}
						<div class="flex flex-col items-center gap-1.5">
							<Badge tone={badge.tone}>{badge.label}</Badge>
							<span class={caption}>tone="{badge.tone}"</span>
						</div>
					{/each}
				</div>
			</article>

			<article class="{card} row-span-2">
				<h2 class="label-caps">ListRow</h2>
				<div class="flex flex-col gap-1 rounded-xl bg-canvas p-2">
					<div class="flex flex-col">
						<ListRow title="Push A" meta="6 exercises · 24 sets" onclick={() => {}} />
						<span class={caption}>onclick</span>
					</div>
					<div class="flex flex-col">
						<ListRow title="Incline Dumbbell Press" meta="Chest · dumbbell" href="#listrow">
							{#snippet leading()}<Stack size={20} />{/snippet}
							{#snippet trailing()}<Badge tone="accent">PR</Badge>{/snippet}
						</ListRow>
						<span class={caption}>href · leading · trailing</span>
					</div>
					<div class="flex flex-col">
						<ListRow title="Export data" onclick={() => {}} chevron={false}>
							{#snippet trailing()}CSV{/snippet}
						</ListRow>
						<span class={caption}>chevron={false}</span>
					</div>
					<div class="flex flex-col">
						<ListRow title="Last synced" meta="Never" />
						<span class={caption}>no href, no onclick — inert</span>
					</div>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">list-group</h2>
				<!-- On `canvas`, which is the only place the fill is visible: dropped on
				     a Sheet the card is border and dividers alone, by design. -->
				<div class="rounded-xl bg-canvas p-2">
					<div class="list-group">
						<ListRow title="Bench Press" meta="80 kg × 8" href="#list-group" />
						<ListRow title="Cable Fly" onclick={() => {}} />
						<ListRow title="Pec Deck" meta="never" />
					</div>
				</div>
				<span class={caption}>rows squared and parted; the card clips the ends</span>
			</article>

			<article class="{card} row-span-2">
				<h2 class="label-caps">DragOrder</h2>
				<div bind:this={dragList.root} class="flex flex-col gap-1 rounded-xl bg-canvas p-2">
					{#each dragItems as item (item.id)}
						{@const lifted = dragList.isLifted(item.id)}
						{@const settling = dragList.settlingId === item.id}

						<!-- The outer/inner split, the sunken slot and the settle spring,
						     exactly as SessionList wires them — the card is the gesture on
						     dummy rows, not a second implementation of it. -->
						<div
							data-drag-id={item.id}
							animate:flip={{ duration: dragSlide }}
							class={lifted ? 'relative z-10 rounded-xl bg-sunken' : ''}
						>
							<div
								style:transform={lifted ? `translateY(${dragList.offset}px) scale(1.02)` : null}
								style:transition={settling && !prefersReducedMotion.current ? SETTLE : null}
								class={[
									'flex min-h-row items-center gap-1 rounded-xl pr-1 pl-3',
									lifted ? 'bg-surface shadow-lg' : 'hover:bg-hover press:bg-surface-2'
								]}
								{@attach press()}
							>
								<button
									type="button"
									onclick={(event) => dragList.swallowClick(event)}
									onpointerdown={(event) => dragList.rowDown(event, item.id)}
									onpointermove={(event) => dragList.move(event)}
									onpointerup={(event) => dragList.up(event)}
									onpointercancel={(event) => dragList.up(event)}
									class="flex min-w-0 flex-1 items-center gap-3 py-2 text-left focus-ring-inset"
								>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-base font-extrabold tracking-tight text-ink">
											{item.name}
										</span>
										<span class="block truncate text-sm font-bold text-ink-faint">
											{item.meta}
										</span>
										{#if item.note !== undefined}
											<span class="block truncate text-sm font-bold text-ink-faint">
												{item.note}
											</span>
										{/if}
									</span>
								</button>

								<span
									role="presentation"
									aria-hidden="true"
									onpointerdown={(event) => dragList.handleDown(event, item.id)}
									onpointermove={(event) => dragList.move(event)}
									onpointerup={(event) => dragList.up(event)}
									onpointercancel={(event) => dragList.up(event)}
									class="grid size-11 shrink-0 cursor-grab touch-none place-items-center
										text-ink-faint select-none"
								>
									<DotsSixVertical size={18} />
								</span>
							</div>
						</div>
					{/each}
				</div>
				<span class={caption}>grip lifts at once · hold 500ms anywhere · Escape cancels</span>
				<span class={caption}
					>the sunken block is the landing · the ends give a little and spring back</span
				>
			</article>

			<article class="{card} row-span-2">
				<h2 class="label-caps">EmptyState</h2>
				<EmptyState
					title="No templates yet"
					description="Plan a session once, start it every gym day."
				>
					{#snippet icon()}<Stack size={24} />{/snippet}
					{#snippet action()}<Button variant="commit" compact>New template</Button>{/snippet}
				</EmptyState>
				<span class={caption}>icon · action — flex-1 centres it in a pane with height to give</span>
			</article>

			<article class={card}>
				<h2 class="label-caps">AddRow</h2>
				<AddRow label="Add exercise" />
				<span class={caption}>the dashed grow-by-one silhouette every list ends on</span>
			</article>

			<article class={card}>
				<h2 class="label-caps">Tooltip</h2>
				<div class={specimen}>
					<Tooltip text="Epley estimate from your best set. Never the headline PR.">
						<span class="text-md font-extrabold">Est. 1RM</span>
					</Tooltip>
					<span class={caption}>hover on a mouse, tap on a touchscreen</span>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">TipButton</h2>
				<!-- The other half of Tooltip: there the ⓘ is the trigger and a word is
				     the thing explained, here the button is both. For a glyph that is
				     the button's only label — an archive box and a stack are one drawing
				     at 20px until you have met both. -->
				<div class={specimen}>
					<div class="flex items-center gap-2">
						<TipButton label="Archive template" onclick={() => {}} class={chromeButton}>
							<Archive size={20} />
						</TipButton>
						<TipButton
							label="Delete template"
							onclick={() => {}}
							class="{chromeButton} text-danger"
						>
							<Trash size={20} />
						</TipButton>
					</div>
					<span class={caption}>label — said aloud, and shown on demand</span>
				</div>
				<p class="text-sm font-bold text-ink-faint">
					A cursor hovers and the bubble follows on the provider's delay. A finger has no hover, so
					the label rides the {HOLD_MS}ms hold instead — and the hold swallows the tap, so asking
					what a button is never also presses it.
				</p>
			</article>

			<article class={card}>
				<h2 class="label-caps">AlertDialog</h2>
				<div class={specimen}>
					<Button variant="destructive" onclick={() => (deleteOpen = true)}>Delete template</Button>
					<span class={caption}>confirmLabel="Delete"</span>
				</div>
				<p class="text-sm font-bold text-ink-faint">
					{deleted ? 'Push A was deleted.' : 'Nothing deleted yet.'}
				</p>
			</article>

			<article class={card}>
				<h2 class="label-caps">Icons</h2>
				<div class="flex flex-wrap items-center gap-5">
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Backspace size={22} /></div>
						<span class={caption}>Backspace</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Check size={22} /></div>
						<span class={caption}>Check</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><More size={20} /></div>
						<span class={caption}>More</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Stack size={22} /></div>
						<span class={caption}>Stack</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><MagnifyingGlass size={22} /></div>
						<span class={caption}>MagnifyingGlass</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><CaretDown size={20} /></div>
						<span class={caption}>CaretDown</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Calendar size={22} /></div>
						<span class={caption}>Calendar</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Info size={22} /></div>
						<span class={caption}>Info</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Cards size={22} /></div>
						<span class={caption}>Cards</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Books size={22} /></div>
						<span class={caption}>Books</span>
					</div>
				</div>
				<!-- The nav's glyphs, each above its selected-state partner. Bold on
				     top, fill under it — the pairing the README calls the intended
				     one, and the reason ListBullets stands alone is in its own file. -->
				<div class="flex flex-wrap items-center gap-5 border-t border-line-soft pt-3">
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Play size={22} /></div>
						<div class={tile}><PlayFill size={22} /></div>
						<span class={caption}>Play</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Barbell size={22} /></div>
						<div class={tile}><BarbellFill size={22} /></div>
						<span class={caption}>Barbell</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><ListBullets size={22} /></div>
						<span class={caption}>ListBullets</span>
					</div>
				</div>
				<!-- The marks the font already supplies, so nothing is drawn for them:
				     the search field's clear, the calendar's month arrows, the row
				     chevron. Measured against the vendored subset, not assumed. -->
				<div class="flex flex-wrap items-center gap-5 border-t border-line-soft pt-3">
					{#each ['×', '‹', '›', '·', '−'] as glyph (glyph)}
						<div class="flex flex-col items-center gap-1.5">
							<div class="{tile} text-xl leading-none">{glyph}</div>
							<span class={caption}>character</span>
						</div>
					{/each}
				</div>
			</article>
		</div>
	</div>
</div>

<AlertDialog
	bind:open={deleteOpen}
	title="Delete template?"
	description="Push A · 6 exercises. Workouts already logged from it are kept."
	confirmLabel="Delete"
	onconfirm={() => (deleted = true)}
/>

<Sheet bind:open={overviewOpen} title="Session" description="Push A · 9 of 25 sets">
	<div class="flex flex-col gap-1">
		{#each exercises as exercise (exercise.name)}
			<div
				class="grid min-h-15 grid-cols-[0.375rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 {exercise.current
					? 'bg-surface-2'
					: ''}"
			>
				<div class="h-8 w-1.5 rounded-full {exercise.current ? 'bg-accent-text' : ''}"></div>
				<div class="min-w-0">
					<div class="text-md font-extrabold tracking-tight">{exercise.name}</div>
					<div class="text-xs font-bold text-ink-faint">{exercise.meta}</div>
				</div>
				<div class="text-md font-extrabold text-ink-muted">{exercise.count}</div>
			</div>
		{/each}
	</div>
</Sheet>

<Menu bind:open={menuOpen} title="Bench Press (Barbell)" anchor={menuAnchor}>
	<MenuItem onselect={() => (menuOpen = false)}>
		<Eye size={18} />
		View exercise
	</MenuItem>
	<MenuItem onselect={() => (menuOpen = false)}>
		<ArrowsLeftRight size={18} />
		Swap exercise
	</MenuItem>
	<MenuItem destructive onselect={() => (menuOpen = false)}>
		<Trash size={18} />
		Remove exercise
	</MenuItem>
</Menu>

<Sheet bind:open={optionsOpen} title="Set 3" description="Bench Press (Barbell)">
	<div class="flex flex-col gap-4">
		{@render pickers(false)}
		<div class="flex gap-2">
			<Button variant="secondary" class="flex-1 justify-start">left shoulder tight</Button>
			<Button variant="destructive">Clear</Button>
		</div>
	</div>
</Sheet>
