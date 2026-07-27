<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { cn } from '$lib/ui/cn';

	// Throwaway proof page. Exercises every piece of the styling setup at once so
	// each one is confirmed by eye rather than assumed. Delete once real screens exist.

	const tokens = [
		{ name: 'surface', bg: 'bg-surface' },
		{ name: 'surface-2', bg: 'bg-surface-2' },
		{ name: 'ink', bg: 'bg-ink' },
		{ name: 'ink-muted', bg: 'bg-ink-muted' },
		{ name: 'border', bg: 'bg-border' },
		{ name: 'accent', bg: 'bg-accent' },
		{ name: 'on-accent', bg: 'bg-on-accent' }
	];

	const weights = [400, 600, 700, 800] as const;

	// Digit-twitch test: these cycle between the widest and narrowest glyphs a
	// proportional face would render. Nothing may shift horizontally.
	let tick = $state(0);
	$effect(() => {
		const id = setInterval(() => (tick += 1), 500);
		return () => clearInterval(id);
	});

	const digits = $derived(tick % 2 === 0 ? '111.11' : '888.88');
	const elapsed = $derived(
		`${String(Math.floor(tick / 120)).padStart(2, '0')}:${String(Math.floor(tick / 2) % 60).padStart(2, '0')}`
	);
</script>

<div class="min-h-dvh bg-surface px-5 pt-safe-t pb-safe-b text-ink">
	<div class="mx-auto flex max-w-md flex-col gap-8 py-8">
		<header>
			<h1 class="text-2xl font-extrabold">Styling proof</h1>
			<p class="text-sm font-normal text-ink-muted">
				Tokens, Nunito, tabular digits, safe areas, Bits UI. Switch your OS theme — every colour
				below follows.
			</p>
		</header>

		<section class="flex flex-col gap-3">
			<h2 class="text-xs font-bold tracking-widest text-ink-muted uppercase">Tokens</h2>
			<div class="flex flex-col gap-2">
				{#each tokens as token (token.name)}
					<div class="flex items-center gap-3">
						<div class={cn('size-10 shrink-0 rounded-lg border border-border', token.bg)}></div>
						<code class="text-sm font-normal">{token.name}</code>
					</div>
				{/each}
			</div>
		</section>

		<section class="flex flex-col gap-3">
			<h2 class="text-xs font-bold tracking-widest text-ink-muted uppercase">
				Nunito — weight axis
			</h2>
			{#each weights as weight (weight)}
				<p style="font-weight: {weight}" class="text-lg">
					{weight} · Bench Press 82.5 kg × 8
				</p>
			{/each}
		</section>

		<section class="flex flex-col gap-3">
			<h2 class="text-xs font-bold tracking-widest text-ink-muted uppercase">
				Tabular digits — nothing may shift
			</h2>
			<div class="flex items-baseline gap-4 rounded-xl border border-border bg-surface-2 p-4">
				<span class="text-4xl font-bold">{digits}</span>
				<span class="text-4xl font-bold text-accent">{elapsed}</span>
			</div>
			<p class="text-sm font-normal text-ink-muted">
				The right edge of each readout must stay put as the digits change.
			</p>
		</section>

		<section class="flex flex-col gap-3">
			<h2 class="text-xs font-bold tracking-widest text-ink-muted uppercase">
				Bits UI — bottom sheet
			</h2>
			<Dialog.Root>
				<Dialog.Trigger
					class="rounded-xl bg-accent px-5 py-4 text-lg font-bold text-on-accent active:opacity-80"
				>
					Open sheet
				</Dialog.Trigger>
				<Dialog.Portal>
					<Dialog.Overlay class="fixed inset-0 bg-black/50" />
					<Dialog.Content
						class="fixed inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-2xl border-t border-border bg-surface px-5 pt-5 pb-[max(1.25rem,var(--spacing-safe-b))] text-ink"
					>
						<Dialog.Title class="text-xl font-bold">Set options</Dialog.Title>
						<Dialog.Description class="text-sm font-normal text-ink-muted">
							Focus trap, scroll lock and dismiss-on-outside come from Bits UI. Everything visible
							here is ours.
						</Dialog.Description>
						<Dialog.Close class="mt-2 rounded-xl border border-border px-5 py-4 text-lg font-bold">
							Close
						</Dialog.Close>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</section>

		<section class="flex flex-col gap-3">
			<h2 class="text-xs font-bold tracking-widest text-ink-muted uppercase">Safe areas</h2>
			<p class="text-sm font-normal text-ink-muted">
				This page is padded with <code>pt-safe-t</code> and <code>pb-safe-b</code>. In Chrome both
				resolve to 0; on the device the content clears the status and gesture bars.
			</p>
		</section>
	</div>
</div>
