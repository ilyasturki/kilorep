<script lang="ts">
	import type { SetStatus } from '$lib/ui/SetMark.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import Numpad from '$lib/ui/Numpad.svelte';
	import SetMark from '$lib/ui/SetMark.svelte';
	import SetRow from '$lib/ui/SetRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import Backspace from '$lib/ui/icons/Backspace.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';

	// An overview of the component library: one card per component, everything
	// live. Tokens and the type scale are not here — src/app.css names them and
	// docs/DESIGN.md holds the reasoning.

	// The page's own furniture. Written out rather than composed at runtime:
	// Tailwind scans source text, so an arbitrary property it has not seen
	// spelled out in full is never emitted.
	const card = 'flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-4';
	const caption = 'text-xs font-extrabold text-ink-faint';
	const tile = 'grid size-8 place-items-center text-ink-muted';

	// Typed, so a mistyped status is a compile error rather than a silent cast.
	const marks: { status: SetStatus; index?: number }[] = [
		{ status: 'done' },
		{ status: 'active', index: 3 },
		{ status: 'pending', index: 4 },
		{ status: 'warmup' }
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

	let setType = $state('normal');
	let rpe = $state('8');
	let overviewOpen = $state(false);
	let optionsOpen = $state(false);
</script>

<svelte:head><title>kilorep · components</title></svelte:head>

<!-- Set type and RPE, the two pickers. Shown twice — standalone and inside the
     options sheet — and the point of the page is that they are the same thing. -->
{#snippet pickers()}
	<h3 class="label-caps">Set type</h3>
	<ChipGroup bind:value={setType} layout="grid" label="Set type">
		<Chip value="normal">Normal</Chip>
		<Chip value="warmup">Warmup</Chip>
		<Chip value="drop">Drop</Chip>
		<Chip value="fail">Fail</Chip>
	</ChipGroup>
	<h3 class="label-caps">RPE</h3>
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
				<h2 class="label-caps">Commit &amp; outlines</h2>
				<Button variant="commit" class="w-full">82.5 × 7</Button>
				<div class="flex flex-wrap gap-2">
					<Button variant="secondary">Add note</Button>
					<Button variant="destructive">Clear</Button>
					<Button variant="chrome">Reopen</Button>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Set type &amp; RPE</h2>
				{@render pickers()}
			</article>

			<article class={card}>
				<h2 class="label-caps">Set marks</h2>
				<div class="flex flex-wrap items-center gap-5">
					{#each marks as mark (mark.status)}
						<div class="flex flex-col items-center gap-1.5">
							<SetMark status={mark.status} index={mark.index} />
							<span class={caption}>{mark.status}</span>
						</div>
					{/each}
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Set rows</h2>
				<div class="flex flex-col gap-2.5 rounded-xl bg-canvas p-3">
					<SetRow status="warmup" weight={20} reps={12} onoptions={() => (optionsOpen = true)}>
						{#snippet right()}warmup{/snippet}
					</SetRow>
					<SetRow
						status="done"
						index={2}
						weight={85}
						reps={8}
						onoptions={() => (optionsOpen = true)}
					>
						{#snippet right()}RPE 8{/snippet}
					</SetRow>
					<SetRow
						status="active"
						index={3}
						weight={85}
						reps={8}
						onoptions={() => (optionsOpen = true)}
					>
						{#snippet right()}<span class="font-extrabold tracking-wider text-accent-text">NOW</span
							>{/snippet}
					</SetRow>
					<SetRow status="pending" index={4} onoptions={() => (optionsOpen = true)}>
						{#snippet right()}80 × 7{/snippet}
					</SetRow>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Stepper fields</h2>
				<div class="flex gap-2">
					<StepperField prefill={82.5} label="kg" step={2.5} class="flex-1" />
					<StepperField prefill={7} label="reps" step={1} class="flex-1" />
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Numpad</h2>
				<Numpad mode="keys" label="Weight · kg" placeholder="82.5" />
			</article>

			<article class={card}>
				<h2 class="label-caps">Bottom sheet &amp; dialog</h2>
				<div class="flex flex-wrap gap-2">
					<Button variant="secondary" onclick={() => (overviewOpen = true)}>
						<Stack size={20} /> Session overview
					</Button>
					<Button variant="secondary" onclick={() => (optionsOpen = true)}>Set options</Button>
				</div>
			</article>

			<article class={card}>
				<h2 class="label-caps">Glyphs</h2>
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
				</div>
			</article>
		</div>
	</div>
</div>

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
		{@render pickers()}
		<div class="flex gap-2">
			<Button variant="secondary" class="flex-1 justify-start">left shoulder tight</Button>
			<Button variant="destructive">Clear</Button>
		</div>
	</div>
</Sheet>
