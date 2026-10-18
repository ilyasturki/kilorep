<script lang="ts">
	import { Popover } from 'bits-ui';

	import { REST_NUDGE_SECONDS } from '$lib/domain/rest';
	import { registerOverlay } from '$lib/ui/overlays';
	import { coarsePointer } from '$lib/ui/pointer';
	import { press } from '$lib/ui/press';
	import Sheet from '$lib/ui/Sheet.svelte';
	import BellSlash from '$lib/ui/icons/BellSlash.svelte';
	import Timer from '$lib/ui/icons/Timer.svelte';
	import { restTimer } from '$lib/workout/rest.svelte';

	let open = $state(false);

	// The one clock: every face of the rest reads `now` off this. 250ms, because the label
	// truncates and a 1s poll would hold a digit for up to two seconds.
	$effect(() => {
		if (!restTimer.running) {
			return;
		}

		restTimer.tick(Date.now());

		const id = setInterval(() => restTimer.tick(Date.now()), 250);

		return () => clearInterval(id);
	});

	// A backgrounded WebView throttles the interval, leaving `now` stale on the way back.
	function wake() {
		if (!document.hidden && restTimer.running) {
			restTimer.tick(Date.now());
		}
	}

	$effect(() => {
		if (!restTimer.running) {
			open = false;
		}
	});

	$effect(() => (open && !coarsePointer ? registerOverlay(() => (open = false)) : undefined));

	const title = $derived(restTimer.name ?? 'Rest');

	function skip() {
		open = false;
		restTimer.skip();
	}

	function mute() {
		open = false;
		restTimer.mute();
	}

	// The tap target is 44px and the pill inside it 36, pulled into the bar's padding by the
	// negative margin so the bar keeps its height whether a rest is running or not.
	const target = '-my-1 flex min-h-11 shrink-0 items-center rounded-full focus-ring';

	const pill =
		'relative flex h-9 items-center gap-1.5 overflow-hidden rounded-full px-3 ' +
		'text-sm font-extrabold tracking-wide';
</script>

<svelte:document onvisibilitychange={wake} />

{#snippet face()}
	<span
		class={[
			pill,
			'bg-sunken tracking-numeral tabular-nums',
			restTimer.overtime ? 'text-accent-text' : 'text-ink'
		]}
	>
		<span
			aria-hidden="true"
			class="absolute inset-y-0 left-0 bg-accent-soft
				motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-linear"
			style="width: {(restTimer.progress * 100).toFixed(1)}%"
		></span>
		<Timer size={16} class="relative shrink-0" />
		<span class="relative text-base">{restTimer.label}</span>
	</span>
{/snippet}

{#snippet controls()}
	<div class="flex flex-col gap-4">
		<div role="timer" aria-label="Rest timer" class="flex flex-col gap-2">
			<span
				class={[
					'text-4xl font-extrabold tracking-numeral tabular-nums',
					restTimer.overtime ? 'text-accent-text' : 'text-ink'
				]}
			>
				{restTimer.label}
			</span>

			<span aria-hidden="true" class="h-1.5 overflow-hidden rounded-full bg-sunken">
				<span
					class="block h-full rounded-full bg-accent
						motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-linear"
					style="width: {(restTimer.progress * 100).toFixed(1)}%"
				></span>
			</span>
		</div>

		<div class="grid grid-cols-3 gap-2">
			{#snippet nudge(by: number, label: string)}
				<button
					type="button"
					aria-label={label}
					onclick={() => restTimer.nudge(by)}
					class="grid min-h-row place-items-center rounded-xl bg-sunken text-md font-extrabold
						text-ink-muted tabular-nums focus-ring hover:bg-hover press:bg-surface-2 press:text-ink"
					{@attach press()}
				>
					{by < 0 ? '−' : '+'}{Math.abs(by)}
				</button>
			{/snippet}

			{@render nudge(-REST_NUDGE_SECONDS, `Cut ${REST_NUDGE_SECONDS} seconds`)}
			{@render nudge(REST_NUDGE_SECONDS, `Add ${REST_NUDGE_SECONDS} seconds`)}

			<button
				type="button"
				onclick={skip}
				class="grid min-h-row place-items-center rounded-xl border border-line text-md
					font-extrabold tracking-caps text-accent-text focus-ring hover:bg-hover
					press:bg-surface-2"
				{@attach press()}
			>
				SKIP
			</button>
		</div>

		<!-- Its own row, a rule and a gap below SKIP and on the far side from it: a thumb that
		     misses SKIP must land on nothing, not on the rest of the session. -->
		<div class="mt-2 border-t border-line-soft pt-3">
			<button
				type="button"
				onclick={mute}
				class="-mx-2 flex min-h-11 items-center gap-2.5 rounded-xl px-2 text-base font-bold
					text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
				{@attach press()}
			>
				<BellSlash size={18} class="shrink-0" />
				Turn rest off for this session
			</button>
		</div>
	</div>
{/snippet}

{#if restTimer.muted}
	<button
		type="button"
		aria-label="Rest is off for this session. Turn it back on"
		onclick={() => restTimer.unmute()}
		class={target}
		{@attach press()}
	>
		<span class={[pill, 'border border-line text-ink-faint']}>
			<BellSlash size={16} class="shrink-0" />
			REST OFF
		</span>
	</button>
{:else if restTimer.running}
	{#if coarsePointer}
		<button
			type="button"
			aria-label="Rest timer, {restTimer.label}. Rest controls"
			aria-haspopup="dialog"
			onclick={() => (open = true)}
			class={target}
			{@attach press()}
		>
			{@render face()}
		</button>

		<Sheet bind:open {title} description="Rest">
			{@render controls()}
		</Sheet>
	{:else}
		<Popover.Root bind:open>
			<Popover.Trigger aria-label="Rest timer, {restTimer.label}. Rest controls" class={target}>
				{@render face()}
			</Popover.Trigger>

			<Popover.Portal>
				<Popover.Content
					sideOffset={6}
					align="end"
					aria-label={title}
					class="overlay-menu w-80 p-4"
				>
					<span class="mb-2 truncate label-caps">{title}</span>
					{@render controls()}
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	{/if}
{:else if restTimer.dismissed !== null}
	<button
		type="button"
		aria-label="Bring back the skipped rest"
		onclick={() => restTimer.bringBack()}
		class={target}
		{@attach press()}
	>
		<span class={[pill, 'border border-line text-accent-text']}>
			<Timer size={16} class="shrink-0" />
			REST
		</span>
	</button>
{/if}
