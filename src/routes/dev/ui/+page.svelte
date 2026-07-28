<script lang="ts">
	import { getLocalTimeZone, today } from '@internationalized/date';
	import type { SetStatus } from '$lib/ui/SetMark.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import DatePicker from '$lib/ui/DatePicker.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Input from '$lib/ui/Input.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Numpad from '$lib/ui/Numpad.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';
	import Select from '$lib/ui/Select.svelte';
	import SetMark from '$lib/ui/SetMark.svelte';
	import SetRow from '$lib/ui/SetRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import Textarea from '$lib/ui/Textarea.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import Backspace from '$lib/ui/icons/Backspace.svelte';
	import Calendar from '$lib/ui/icons/Calendar.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import Info from '$lib/ui/icons/Info.svelte';
	import MagnifyingGlass from '$lib/ui/icons/MagnifyingGlass.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';

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
	const steppers = [
		{ prefill: 82.5, label: 'kg', step: 2.5, prop: 'step={2.5}' },
		{ prefill: 7, label: 'reps', step: 1, prop: 'step={1}' }
	];

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

	let setType = $state('normal');
	let rpe = $state('8');
	let overviewOpen = $state(false);
	let optionsOpen = $state(false);

	let exerciseName = $state('Bench Press (Barbell)');
	let note = $state('');
	let query = $state('');
	let equipment = $state('dumbbell');
	let muscles = $state(['chest', 'triceps']);
	let chipMuscles = $state(['chest']);
	let date = $state(today(getLocalTimeZone()));
	let keepAwake = $state(true);
	let syncEnabled = $state(false);
	let deleteOpen = $state(false);
	// The card reports what the confirm actually did, so the dialog can be
	// checked for the thing it is for rather than for opening prettily.
	let deleted = $state(false);
</script>

<svelte:head><title>kilorep · components</title></svelte:head>

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
		<h3 class="label-caps">RPE</h3>
		{#if annotated}<span class={caption}>layout="wrap"</span>{/if}
	</div>
	<ChipGroup bind:value={rpe} label="RPE">
		{#each ['—', '7', '7.5', '8', '9', '10'] as value (value)}
			<Chip {value}>{value}</Chip>
		{/each}
	</ChipGroup>
{/snippet}

<div class="min-h-dvh bg-canvas px-6 pt-safe-t pb-16 text-ink">
	<div class="mx-auto flex max-w-[1280px] flex-col gap-6 pt-6">
		<h1 class="text-lg font-extrabold tracking-tight">kilorep · components</h1>

		<!-- items-start, not the default stretch: a card hugs its own content, so a
		     four-glyph card does not inflate to the height of the numpad beside it. -->
		<div
			class="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))] items-start gap-4"
		>
			<article class={card}>
				<h2 class="label-caps">Button</h2>
				<div class={specimen}>
					<Button variant="commit" class="w-full">82.5 × 7</Button>
					<span class={caption}>variant="commit"</span>
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

			<article class={card}>
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

			<article class={card}>
				<h2 class="label-caps">SetRow</h2>
				<div class="flex flex-col gap-2.5 rounded-xl bg-canvas p-3">
					<div class="flex flex-col gap-1">
						<span class={caption}>status="warmup"</span>
						<SetRow status="warmup" weight={20} reps={12} onoptions={() => (optionsOpen = true)}>
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
							onoptions={() => (optionsOpen = true)}
						>
							{#snippet right()}RPE 8{/snippet}
						</SetRow>
					</div>
					<div class="flex flex-col gap-1">
						<span class={caption}>status="active"</span>
						<SetRow
							status="active"
							index={3}
							weight={85}
							reps={8}
							onoptions={() => (optionsOpen = true)}
						>
							{#snippet right()}<span class="font-extrabold tracking-wider text-accent-text"
									>NOW</span
								>{/snippet}
						</SetRow>
					</div>
					<div class="flex flex-col gap-1">
						<span class={caption}>status="pending"</span>
						<SetRow status="pending" index={4} onoptions={() => (optionsOpen = true)}>
							{#snippet right()}80 × 7{/snippet}
						</SetRow>
					</div>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">StepperField</h2>
				<div class="flex gap-2">
					{#each steppers as stepper (stepper.label)}
						<div class="flex flex-1 flex-col gap-1.5">
							<StepperField prefill={stepper.prefill} label={stepper.label} step={stepper.step} />
							<span class={caption}>{stepper.prop}</span>
						</div>
					{/each}
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Numpad</h2>
				<div class="flex flex-col gap-1.5">
					<Numpad mode="keys" label="Weight · kg" placeholder="82.5" />
					<span class={caption}>mode="keys"</span>
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

			<article class={card}>
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
				<h2 class="label-caps">EmptyState</h2>
				<EmptyState
					title="No templates yet"
					description="Build one, or start an empty workout and log as you go."
				>
					{#snippet icon()}<Stack size={24} />{/snippet}
					{#snippet action()}<Button variant="secondary">New template</Button>{/snippet}
				</EmptyState>
				<span class={caption}>icon · action</span>
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

<Sheet bind:open={optionsOpen} title="Set 3" description="Bench Press (Barbell)">
	<div class="flex flex-col gap-4">
		{@render pickers(false)}
		<div class="flex gap-2">
			<Button variant="secondary" class="flex-1 justify-start">left shoulder tight</Button>
			<Button variant="destructive">Clear</Button>
		</div>
	</div>
</Sheet>
