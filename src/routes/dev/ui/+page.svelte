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
	import More from '$lib/ui/icons/More.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';

	// The component library, every part and every state on one page. This is the
	// review surface — open it in Chrome at a phone width and at a desktop width,
	// and on the device once the Capacitor shell exists.

	// The page's own furniture. Written out rather than composed at runtime:
	// Tailwind scans source text, so an arbitrary property it has not seen
	// spelled out in full is never emitted.
	const card = 'flex flex-col rounded-2xl border border-line-soft bg-surface p-4';
	const caption = 'text-xs font-extrabold text-ink-faint';
	const note = 'text-sm font-bold text-ink-faint';
	const cards22 = 'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]';
	const cards24 = 'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]';
	const cards26 = 'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr))]';

	// Written out as literal class strings rather than `var(--color-${name})`.
	// `@theme inline` inlines a token's value into the utilities that use it and
	// does not guarantee a matching custom property survives to runtime, so a
	// constructed `var()` silently resolves to nothing. Tailwind's scanner does
	// read string literals, so these are real classes.
	const swatches = [
		{ cls: 'bg-canvas', name: 'canvas' },
		{ cls: 'bg-surface', name: 'surface' },
		{ cls: 'bg-surface-2', name: 'surface-2' },
		{ cls: 'bg-sunken', name: 'sunken' },
		{ cls: 'bg-ink', name: 'ink' },
		{ cls: 'bg-ink-muted', name: 'ink-muted' },
		{ cls: 'bg-ink-faint', name: 'ink-faint' },
		{ cls: 'bg-line', name: 'line' },
		{ cls: 'bg-line-soft', name: 'line-soft' },
		{ cls: 'bg-accent', name: 'accent' },
		{ cls: 'bg-on-accent', name: 'on-accent' },
		{ cls: 'bg-accent-text', name: 'accent-text' },
		{ cls: 'bg-accent-soft', name: 'accent-soft' },
		{ cls: 'bg-danger', name: 'danger' },
		{ cls: 'bg-scrim', name: 'scrim' }
	];

	const type = [
		{ name: 'text-4xl', cls: 'text-4xl font-extrabold tracking-numeral', sample: '82.5' },
		{ name: 'text-3xl', cls: 'text-3xl font-extrabold tracking-numeral', sample: '85 × 8' },
		{ name: 'text-2xl', cls: 'text-2xl font-extrabold tracking-tight', sample: 'Bench Press' },
		{ name: 'text-xl', cls: 'text-xl font-extrabold tracking-tight', sample: 'Incline Press' },
		{ name: 'text-lg', cls: 'text-lg font-extrabold tracking-tight', sample: 'Session' },
		{ name: 'text-base', cls: 'text-base font-bold', sample: 'Enter a weight to log' },
		{ name: 'text-md', cls: 'text-md font-bold text-ink-muted', sample: 'Set 3 of 4 · rest 3:00' },
		{ name: 'text-sm', cls: 'text-sm font-bold text-ink-faint', sample: 'last 82.5 × 7' },
		{ name: 'text-xs', cls: 'label-caps', sample: 'superset · next · rest' }
	];

	const targets = [
		{ name: 'chrome', cls: 'min-h-chrome', note: 'top bar, pills' },
		{ name: 'chip', cls: 'min-h-chip', note: 'set type, RPE' },
		{ name: 'row', cls: 'min-h-row', note: 'set rows, pad keys' },
		{ name: 'commit', cls: 'min-h-commit', note: 'the one filled button' }
	];

	const radii = [
		{ cls: 'rounded-lg', size: '8' },
		{ cls: 'rounded-xl', size: '12' },
		{ cls: 'rounded-2xl', size: '16' },
		{ cls: 'rounded-sheet', size: '22' },
		{ cls: 'rounded-full', size: 'full' }
	];

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
	let weight = $state(82.5);
	let reps = $state(7);
	let padded = $state('—');
	let overviewOpen = $state(false);
	let optionsOpen = $state(false);
</script>

<svelte:head><title>kilorep · component library</title></svelte:head>

{#snippet heading(n: string, title: string)}
	<div class="flex items-baseline gap-3">
		<span class="text-xs font-extrabold tracking-label text-accent-text">{n}</span>
		<h2 class="text-xl font-extrabold tracking-tight">{title}</h2>
	</div>
{/snippet}

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

<div class="min-h-dvh bg-canvas pt-safe-t pb-24 text-ink">
	<header class="sticky top-0 z-20 border-b border-line bg-canvas px-6 py-4">
		<div class="mx-auto max-w-[1280px]">
			<h1 class="text-lg font-extrabold tracking-tight">kilorep · component library</h1>
			<p class={note}>
				Every primitive the app is built from. Resize the window — layout follows each component's
				own box, interaction follows your pointer.
			</p>
		</div>
	</header>

	<div class="mx-auto flex max-w-[1280px] flex-col gap-14 px-6 pt-6">
		<!-- 01 ────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-4">
			{@render heading('01', 'Foundations')}

			<div class={cards22}>
				<article class="{card} gap-3">
					<h3 class="label-caps">Surface &amp; ink</h3>
					<div class="grid grid-cols-4 gap-2 rounded-xl bg-canvas p-3">
						{#each swatches as swatch (swatch.name)}
							<div class="flex flex-col gap-1.5">
								<div class="h-11 rounded-lg border border-line {swatch.cls}"></div>
								<span class={caption}>{swatch.name}</span>
							</div>
						{/each}
					</div>
					<p class={note}>
						<span class="text-accent-text">accent-text</span> carries every accent-coloured string;
						<span class="rounded bg-accent px-1 text-on-accent">accent</span> is only ever a fill. lime-400
						as text on white measures 1.51:1.
					</p>
				</article>

				<article class="{card} gap-3">
					<h3 class="label-caps">Type · Nunito</h3>
					{#each type as step (step.name)}
						<div class="flex items-baseline gap-3">
							<span class="w-20 shrink-0 {caption}">{step.name}</span>
							<span class={step.cls}>{step.sample}</span>
						</div>
					{/each}
					<p class={note}>All numerals tabular. Sizes in rem, so OS text scaling moves them.</p>
				</article>

				<article class="{card} gap-4">
					<h3 class="label-caps">Radii &amp; targets</h3>
					<div class="flex flex-wrap items-end gap-3">
						{#each radii as radius (radius.cls)}
							<div class="flex flex-col items-center gap-1.5">
								<div class="size-14 bg-sunken {radius.cls}"></div>
								<span class={caption}>{radius.size}</span>
							</div>
						{/each}
					</div>
					<div class="flex flex-col gap-2">
						{#each targets as target (target.name)}
							<div class="flex items-center gap-3">
								<div
									class="grid {target.cls} place-items-center rounded-xl bg-sunken px-3 text-sm font-extrabold text-ink-muted"
								>
									{target.name}
								</div>
								<span class={note}>{target.note}</span>
							</div>
						{/each}
					</div>
					<p class={note}>
						min-heights in rem, not fixed px — they grow with OS text size, and shrink when the only
						pointer present is a mouse.
					</p>
				</article>
			</div>
		</section>

		<!-- 02 ────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-4">
			{@render heading('02', 'Buttons & chips')}

			<div class={cards22}>
				<article class="{card} gap-3">
					<h3 class="label-caps">Commit &amp; inert</h3>
					<Button variant="commit" class="w-full">82.5 × 7</Button>
					<Button variant="commit" disabled class="w-full">Enter a weight to log</Button>
					<h3 class="mt-2 label-caps">Secondary, destructive, chrome</h3>
					<div class="flex flex-wrap gap-2">
						<Button variant="secondary">Add note</Button>
						<Button variant="destructive">Clear</Button>
						<Button variant="chrome">Reopen</Button>
						<Button variant="chrome" caps>FINISH</Button>
					</div>
					<p class={note}>
						Only one filled button per screen — the commit. Tab through them: every control has a
						focus ring, which the source design had none of.
					</p>
				</article>

				<article class="{card} gap-4">
					{@render pickers()}
					<p class={note}>
						One tab stop per group, arrow keys move between chips — Bits UI ToggleGroup. Selected: <span
							class="text-accent-text">{setType} · RPE {rpe}</span
						>
					</p>
				</article>

				<article class="{card} gap-4">
					<h3 class="label-caps">Marks &amp; glyphs</h3>
					<div class="flex flex-wrap items-center gap-5">
						{#each marks as mark (mark.status)}
							<div class="flex flex-col items-center gap-1.5">
								<SetMark status={mark.status} index={mark.index} />
								<span class={caption}>{mark.status}</span>
							</div>
						{/each}
						<div class="flex flex-col items-center gap-1.5">
							<div class="grid size-8 place-items-center"><Stack size={22} /></div>
							<span class={caption}>overview</span>
						</div>
						<div class="flex flex-col items-center gap-1.5">
							<div class="grid size-8 place-items-center">
								<div class="size-1.5 rounded-full bg-accent-text"></div>
							</div>
							<span class={caption}>edited</span>
						</div>
						<div class="flex flex-col items-center gap-1.5">
							<div class="grid size-8 place-items-center text-ink-muted">
								<Backspace size={22} />
							</div>
							<span class={caption}>delete</span>
						</div>
						<div class="flex flex-col items-center gap-1.5">
							<div class="grid size-8 place-items-center text-ink-muted"><More size={20} /></div>
							<span class={caption}>options</span>
						</div>
					</div>
					<p class={note}>
						Four SVG glyphs, no icon library. Delete and options are drawn rather than typed: the
						design used ⌫ and ⋯ as characters, and neither is in the Nunito subset we ship — both
						render as tofu. × − + · are in the font and stay characters.
					</p>
				</article>
			</div>
		</section>

		<!-- 03 ────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-4">
			{@render heading('03', 'Set rows')}

			<div class={cards26}>
				<article class="{card} gap-3">
					<h3 class="label-caps">Four states</h3>
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
							{#snippet right()}<span class="font-extrabold tracking-wider text-accent-text"
									>NOW</span
								>{/snippet}
						</SetRow>
						<SetRow status="pending" index={4} onoptions={() => (optionsOpen = true)}>
							{#snippet right()}80 × 7{/snippet}
						</SetRow>
					</div>
					<p class={note}>
						Long-press any row for options on touch; with a mouse, the dots button on the right, or
						right-click anywhere on the row.
					</p>
				</article>

				<article class="{card} [grid-column:1/-1] gap-3">
					<h3 class="label-caps">Container query — same component, two boxes</h3>
					<div class="flex flex-col gap-3">
						<div class="w-56 rounded-xl bg-canvas p-2">
							<SetRow status="active" index={3} weight={107.5} reps={12}>
								{#snippet right()}<span class="text-accent-text">NOW</span>{/snippet}
							</SetRow>
							<p class="pt-2 {caption}">224px container — numerals on 80 / 22 / 40</p>
						</div>
						<div class="min-w-0 rounded-xl bg-canvas p-2">
							<SetRow status="active" index={3} weight={107.5} reps={12}>
								{#snippet right()}<span class="text-accent-text">NOW</span>{/snippet}
							</SetRow>
							<p class="pt-2 {caption}">past 448px — numerals open to 104 / 26 / 56</p>
						</div>
					</div>
					<p class={note}>
						Both rows are on the same viewport. Layout follows the component's own box, so a row in
						a narrow History panel stays compact on a 1400px screen.
					</p>
				</article>
			</div>
		</section>

		<!-- 04 ────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-4">
			{@render heading('04', 'Entry')}

			<div class={cards24}>
				<article class="{card} gap-3">
					<h3 class="label-caps">Stepper fields — try them</h3>
					<p class={note}>last 82.5 × 7</p>
					<div class="flex gap-2">
						<StepperField
							prefill={82.5}
							label="kg"
							step={2.5}
							onchange={(v) => (weight = v)}
							class="flex-1"
						/>
						<StepperField
							prefill={7}
							label="reps"
							step={1}
							onchange={(v) => (reps = v)}
							class="flex-1"
						/>
					</div>
					<Button variant="commit" class="w-full">{weight} × {reps}</Button>
					<p class={note}>
						Step either field away from its prefill and a dot appears — that dot is the difference
						between committing a recalled hint and committing a claim.
					</p>
				</article>

				<article class="{card} gap-3">
					<h3 class="label-caps">Numpad — touch</h3>
					<Numpad
						mode="keys"
						label="Weight · kg"
						placeholder="82.5"
						onconfirm={(v) => (padded = v)}
					/>
					<p class={note}>Last confirmed: {padded}</p>
				</article>

				<article class="{card} gap-3">
					<h3 class="label-caps">Numpad — keyboard</h3>
					<Numpad
						mode="input"
						label="Weight · kg"
						placeholder="82.5"
						onconfirm={(v) => (padded = v)}
					/>
					<p class={note}>
						Both modes are pinned here for review. Unpinned, the component picks from
						<code>pointer: coarse</code> — grid for thumbs, field for keys.
					</p>
				</article>
			</div>
		</section>

		<!-- 05 ────────────────────────────────────────────────── -->
		<section class="flex flex-col gap-4">
			{@render heading('05', 'Sheets')}

			<article class="{card} max-w-[26rem] gap-3">
				<h3 class="label-caps">Bottom sheet on touch, centred dialog on a wide window</h3>
				<div class="flex flex-wrap gap-2">
					<Button variant="secondary" onclick={() => (overviewOpen = true)}>
						<Stack size={20} /> Session overview
					</Button>
					<Button variant="secondary" onclick={() => (optionsOpen = true)}>Set options</Button>
				</div>
				<p class={note}>
					Narrow the window below 640px and reopen — the same sheet slides from the bottom edge
					instead of centring.
				</p>
			</article>
		</section>
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
