<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import type { SetStatus } from '$lib/ui/SetMark.svelte';
	import Card from '$lib/styleguide/Card.svelte';
	import ChromeSection from '$lib/styleguide/ChromeSection.svelte';
	import DataSection from '$lib/styleguide/DataSection.svelte';
	import PlanSection from '$lib/styleguide/PlanSection.svelte';
	import Spec from '$lib/styleguide/Spec.svelte';
	import WorkoutSection from '$lib/styleguide/WorkoutSection.svelte';
	import { bento, caption, chromeButton, specimen, tile } from '$lib/styleguide/chrome';
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

	const outlined = [
		{ variant: 'secondary', label: 'Add note' },
		{ variant: 'destructive', label: 'Clear' },
		{ variant: 'chrome', label: 'Reopen' }
	] as const;

	const marks: { status: SetStatus; index?: number }[] = [
		{ status: 'done' },
		{ status: 'active', index: 3 },
		{ status: 'pending', index: 4 },
		{ status: 'warmup' }
	];

	type Stepper = {
		value: number | null;
		recalled: number;
		label: string;
		step: number;
		ruler: boolean;
		rulerStep?: number;
		major?: number;
		min?: number;
		max?: number;
		prop: string;
	};

	const steppers = $state<Stepper[]>([
		{
			value: 82.5,
			recalled: 82.5,
			label: 'kg',
			step: 2.5,
			ruler: false,
			prop: 'step={2.5}'
		},
		{
			value: 7,
			recalled: 7,
			label: 'reps',
			step: 1,
			ruler: false,
			prop: 'step={1}'
		},
		{
			value: 100,
			recalled: 100,
			label: 'kg',
			step: 2.5,
			ruler: true,
			prop: 'ruler (touch only)'
		},
		{
			value: 82.4,
			recalled: 82.4,
			label: 'kg',
			step: 0.1,
			ruler: true,
			rulerStep: 0.05,
			major: 10,
			min: 20,
			max: 300,
			prop: 'rulerStep={0.05}'
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

	const dragSlide = $derived(prefersReducedMotion.current ? 0 : 200);

	let setType = $state('normal');
	let rpe = $state<number | null>(8);
	let overviewOpen = $state(false);
	let optionsOpen = $state(false);

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
	let half = $state('templates');
	const halves = [
		{ value: 'templates', label: 'Templates', icon: Cards },
		{ value: 'exercises', label: 'Exercises', icon: Books }
	];
	let date = $state(today(getLocalTimeZone()));
	let keepAwake = $state(true);
	let syncEnabled = $state(false);
	let deleteOpen = $state(false);
	let deleted = $state(false);

	// The sheet is long enough that scrolling it end to end to find one component is the slow
	// way round. Ordered the way the app is built up: the pieces, then the screens made of them.
	const index = [
		{ id: 'controls', label: 'Controls' },
		{ id: 'fields', label: 'Fields' },
		{ id: 'rows', label: 'Rows & lists' },
		{ id: 'overlays', label: 'Overlays' },
		{ id: 'foundations', label: 'Icons' },
		{ id: 'chrome', label: 'Nav & settings' },
		{ id: 'workout', label: 'Workout' },
		{ id: 'plan', label: 'Plan' },
		{ id: 'data', label: 'Progress & weight' }
	];
</script>

<svelte:head><title>Components | Kilorep</title></svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && dragList.cancel()} />

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
	<div class="flex flex-col gap-2">
		<ExertionPicker value={rpe} scale="rpe" onchange={(next) => (rpe = next)} />
		<ExertionPicker value={rpe} scale="rir" onchange={(next) => (rpe = next)} />
	</div>
{/snippet}

{#snippet band(id: string, title: string, blurb: string)}
	<div class="flex flex-col gap-1 pt-2" {id}>
		<h2 class="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
		<p class="text-sm font-bold text-ink-faint">{blurb}</p>
	</div>
{/snippet}

<div class="min-h-dvh bg-canvas px-6 pt-safe-t pb-16 text-ink">
	<div class="mx-auto flex max-w-[1280px] flex-col gap-6 pt-6">
		<header class="flex flex-col gap-3">
			<h1 class="text-2xl font-extrabold tracking-tight">Components</h1>
			<p class="max-w-2xl text-md font-bold text-ink-muted">
				Every component the app is built from, running the same code the app runs. Steppers step,
				sheets open, the ledger reorders — what is on this page behaves the way it behaves on a
				screen, so a change can be judged here before it is judged in the gym.
			</p>
			<nav aria-label="Sections" class="flex flex-wrap gap-x-1 gap-y-1">
				{#each index as entry (entry.id)}
					<a
						href="#{entry.id}"
						class="min-h-chrome rounded-full px-3 py-2 text-sm font-extrabold text-ink-muted
							focus-ring hover:bg-hover press:bg-surface-2"
						{@attach press()}
					>
						{entry.label}
					</a>
				{/each}
			</nav>
		</header>

		{@render band(
			'controls',
			'Controls',
			'Pressed, toggled, picked — nothing that holds a number.'
		)}

		<div class={bento}>
			<Card name="Button">
				<Spec label={`variant="commit"`} full>
					<Button variant="commit" class="w-full">82.5 × 7</Button>
				</Spec>
				<Spec label={`variant="raised" — surface-filled, for a row on the canvas`} full>
					<Button variant="raised" class="w-full">+ New template</Button>
				</Spec>
				<div class="flex flex-wrap gap-x-4 gap-y-3">
					{#each outlined as button (button.variant)}
						<Spec label={`variant="${button.variant}"`}>
							<Button variant={button.variant}>{button.label}</Button>
						</Spec>
					{/each}
				</div>
			</Card>

			<Card name="press" note="the attachment every pressable thing wears">
				<Spec label="tint + sink, no `onhold`" full>
					<button
						type="button"
						class="min-h-row w-full press-sink rounded-xl border border-line px-4 text-md
							font-bold text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
						{@attach press()}
					>
						Hold me — nothing happens
					</button>
				</Spec>

				<Spec
					label={`\`onhold\` — buzzes at ${HOLD_MS}ms, cancels past ${SLOP}px, eats the click`}
					full
				>
					<button
						type="button"
						class="min-h-row w-full press-sink rounded-xl border border-line px-4 text-md
							font-bold text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
						{@attach press(() => openMenu)}
					>
						Hold me — a menu opens
					</button>
				</Spec>
			</Card>

			<Card name="ChipGroup · Chip · ExertionPicker" tall>
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
			</Card>

			<Card name="Segmented">
				<Segmented bind:value={half} items={halves} label="Plan" />
				<span class={caption}>full width · `icon` per segment · arrow keys between them</span>
			</Card>

			<Card name="Switch">
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
			</Card>

			<Card name="SetMark" note="the dot a set is counted by">
				<div class="flex flex-wrap items-center gap-5">
					{#each marks as mark (mark.status)}
						<div class="flex flex-col items-center gap-1.5">
							<SetMark status={mark.status} index={mark.index} />
							<span class={caption}>status="{mark.status}"</span>
						</div>
					{/each}
				</div>
			</Card>

			<Card name="Badge">
				<div class="flex flex-wrap items-center gap-5">
					{#each badges as badge (badge.tone)}
						<div class="flex flex-col items-center gap-1.5">
							<Badge tone={badge.tone}>{badge.label}</Badge>
							<span class={caption}>tone="{badge.tone}"</span>
						</div>
					{/each}
				</div>
			</Card>
		</div>

		{@render band('fields', 'Fields', 'Everything that holds a value and hands it back.')}

		<div class={bento}>
			<Card name="StepperField" note="two 44px arms around a number">
				<!-- A stepper is two 44px targets around a readout: below ~10rem the value is
				     squeezed to nothing and the glyphs collide. The specimens wrap rather than
				     divide the card, so every one of them stays the size the gym floor gets. -->
				<div class="grid [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))] gap-2">
					{#each steppers as stepper (stepper.prop)}
						<div class="flex min-w-0 flex-col gap-1.5">
							<StepperField
								bind:value={stepper.value}
								recalled={stepper.recalled}
								label={stepper.label}
								step={stepper.step}
								ruler={stepper.ruler}
								rulerStep={stepper.rulerStep}
								major={stepper.major}
								min={stepper.min}
								max={stepper.max}
							/>
							<span class={caption}>{stepper.prop}</span>
						</div>
					{/each}
				</div>
				<span class={caption}>
					the ruler opens on a tap on the number, and only under a coarse pointer
				</span>
			</Card>

			<Card name="Input">
				<Spec label={`label="Exercise"`} full>
					<Input label="Exercise" bind:value={exerciseName} class="w-full" />
				</Spec>
				<Spec label={`error="…"`} full>
					<Input
						label="Exercise"
						value="Bench Press (Barbell)"
						error="Already in your exercises"
						class="w-full"
					/>
				</Spec>
			</Card>

			<Card name="Textarea">
				<Spec label="rows={3}" full>
					<Textarea
						label="Note"
						bind:value={note}
						placeholder="left shoulder tight"
						class="w-full"
					/>
				</Spec>
			</Card>

			<Card name="SearchField">
				<Spec label="label is the accessible name, not a heading" full>
					<SearchField label="Search exercises" bind:value={query} class="w-full" />
				</Spec>
			</Card>

			<Card name="Select" note="a sheet on a phone, a listbox on a pointer">
				<Spec label={`type="single"`} full>
					<Select label="Equipment" items={equipmentItems} bind:value={equipment} class="w-full" />
				</Spec>
				<Spec label={`type="multiple"`} full>
					<Select
						label="Muscle targets"
						items={muscleItems}
						bind:value={muscles}
						type="multiple"
						class="w-full"
					/>
				</Spec>
			</Card>

			<Card name="DatePicker">
				<Spec label="maxToday" full>
					<DatePicker label="Date" bind:value={date} maxToday class="w-full" />
				</Spec>
			</Card>
		</div>

		{@render band(
			'rows',
			'Rows & lists',
			'The shapes a list is made of, and what a list does when it is empty.'
		)}

		<div class={bento}>
			<Card name="SetRow" tall>
				<div class="flex flex-col gap-2.5 rounded-xl bg-canvas p-3">
					<div class="flex flex-col gap-1">
						<span class={caption}>status="warmup"</span>
						<SetRow status="warmup" weight={20} reps={12} onoptions={openMenu}>
							{#snippet right()}warmup{/snippet}
						</SetRow>
					</div>
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
			</Card>

			<Card name="ListRow" tall>
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
			</Card>

			<Card name="list-group" note="the class, not a component">
				<div class="rounded-xl bg-canvas p-2">
					<div class="list-group">
						<ListRow title="Bench Press" meta="80 kg × 8" href="#list-group" />
						<ListRow title="Cable Fly" onclick={() => {}} />
						<ListRow title="Pec Deck" meta="never" />
					</div>
				</div>
				<span class={caption}>rows squared and parted; the card clips the ends</span>
			</Card>

			<Card name="DragOrder" note="the runtime, driving a hand-rolled list" tall>
				<div bind:this={dragList.root} class="flex flex-col gap-1 rounded-xl bg-canvas p-2">
					{#each dragItems as item (item.id)}
						{@const lifted = dragList.isLifted(item.id)}
						{@const settling = dragList.settlingId === item.id}

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
				<span class={caption}>DragList wraps this — see PlanList under Plan</span>
			</Card>

			<Card name="AddRow">
				<AddRow label="Add exercise" />
				<span class={caption}>the dashed grow-by-one silhouette every list ends on</span>
			</Card>

			<Card name="EmptyState" tall>
				<EmptyState
					title="No templates yet"
					description="Plan a session once, start it every gym day."
				>
					{#snippet icon()}<Stack size={24} />{/snippet}
					{#snippet action()}<Button variant="commit" compact>New template</Button>{/snippet}
				</EmptyState>
				<span class={caption}>icon · action — flex-1 centres it in a pane with height to give</span>
			</Card>
		</div>

		{@render band('overlays', 'Overlays', 'What opens over the screen, and what it opens from.')}

		<div class={bento}>
			<Card name="Sheet">
				<div class="flex flex-wrap gap-x-4 gap-y-3">
					<Spec label={`title="Session"`}>
						<Button variant="secondary" onclick={() => (overviewOpen = true)}>
							<Stack size={20} /> Session overview
						</Button>
					</Spec>
					<Spec label={`title="Set 3"`}>
						<Button variant="secondary" onclick={() => (optionsOpen = true)}>Set options</Button>
					</Spec>
				</div>
				<span class={caption}>SheetHeader is inside it — Select and DatePicker use it too</span>
			</Card>

			<Card name="Menu · MenuItem" note="anchored to whatever asked for it">
				<div class="flex flex-col gap-2 rounded-xl bg-canvas p-2">
					<div class="flex min-h-row items-center gap-2 rounded-xl pr-1 pl-3">
						<span class="min-w-0 flex-1 truncate text-base font-extrabold tracking-tight">
							Bench Press (Barbell)
						</span>
						<button
							type="button"
							aria-label="Exercise options"
							onclick={(e) => openMenu(e.currentTarget)}
							class="grid min-h-chrome w-11 shrink-0 place-items-center rounded-full
								text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
							{@attach press()}
						>
							<More size={20} />
						</button>
					</div>
				</div>
				<span class={caption}
					>the ⋯ is the anchor — the menu opens against the row it belongs to</span
				>
			</Card>

			<Card name="AlertDialog">
				<Spec label={`confirmLabel="Delete"`}>
					<Button variant="destructive" onclick={() => (deleteOpen = true)}>Delete template</Button>
				</Spec>
				<p class="text-sm font-bold text-ink-faint">
					{deleted ? 'Push A was deleted.' : 'Nothing deleted yet.'}
				</p>
			</Card>

			<Card name="Tooltip">
				<Spec label="hover on a mouse, tap on a touchscreen">
					<Tooltip text="Epley estimate from your best set. Never the headline PR.">
						<span class="text-md font-extrabold">Est. 1RM</span>
					</Tooltip>
				</Spec>
			</Card>

			<Card name="TipButton">
				<Spec label="label — said aloud, and shown on demand">
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
				</Spec>
				<p class="text-sm font-bold text-ink-faint">
					A cursor hovers and the bubble follows on the provider's delay. A finger has no hover, so
					the label rides the {HOLD_MS}ms hold instead — and the hold swallows the tap, so asking
					what a button is never also presses it.
				</p>
			</Card>
		</div>

		{@render band(
			'foundations',
			'Icons',
			'One weight, one size vocabulary. Fill is for a selected tab, never for emphasis.'
		)}

		<div class={bento}>
			<Card name="Icons" wide>
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
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><ListBullets size={22} /></div>
						<span class={caption}>ListBullets</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><DotsSixVertical size={18} /></div>
						<span class={caption}>DotsSixVertical</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Archive size={22} /></div>
						<span class={caption}>Archive</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Trash size={22} /></div>
						<span class={caption}>Trash</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><Eye size={22} /></div>
						<span class={caption}>Eye</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class={tile}><ArrowsLeftRight size={22} /></div>
						<span class={caption}>ArrowsLeftRight</span>
					</div>
				</div>

				<div class="flex flex-wrap items-center gap-5 border-t border-line-soft pt-3">
					<div class="flex flex-col items-center gap-1.5">
						<div class="flex items-center gap-1">
							<div class={tile}><Play size={22} /></div>
							<div class={tile}><PlayFill size={22} /></div>
						</div>
						<span class={caption}>Play · PlayFill</span>
					</div>
					<div class="flex flex-col items-center gap-1.5">
						<div class="flex items-center gap-1">
							<div class={tile}><Barbell size={22} /></div>
							<div class={tile}><BarbellFill size={22} /></div>
						</div>
						<span class={caption}>Barbell · BarbellFill</span>
					</div>
					<p class="max-w-xs text-sm font-bold text-ink-faint">
						A pair is an outline and its fill. The fill marks the selected tab in the nav bars and
						nothing else.
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-5 border-t border-line-soft pt-3">
					{#each ['×', '‹', '›', '·', '−'] as glyph (glyph)}
						<div class="flex flex-col items-center gap-1.5">
							<div class="{tile} text-xl leading-none">{glyph}</div>
							<span class={caption}>character</span>
						</div>
					{/each}
					<p class="max-w-xs text-sm font-bold text-ink-faint">
						Set in the face rather than drawn, so they take the weight of the text beside them.
					</p>
				</div>
			</Card>
		</div>

		{@render band(
			'chrome',
			'Nav & settings',
			'The frame around every screen, and the rows inside the one that configures it.'
		)}

		<div class={bento}><ChromeSection /></div>

		{@render band(
			'workout',
			'Workout',
			'The screen the app exists for, in the pieces it is assembled from.'
		)}

		<div class={bento}><WorkoutSection onoptions={openMenu} /></div>

		{@render band('plan', 'Plan', 'What a session is before it is performed.')}

		<div class={bento}><PlanSection onoptions={openMenu} /></div>

		{@render band('data', 'Progress & weight', 'Numbers that have already happened.')}

		<div class={bento}><DataSection /></div>
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
