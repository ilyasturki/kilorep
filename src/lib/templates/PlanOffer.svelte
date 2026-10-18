<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { planOffer } from '$lib/domain/drift';
	import type { Template } from '$lib/domain/template';
	import type { Workout } from '$lib/domain/workout';
	import { changesLine, swapLabel } from '$lib/templates/offer';
	import { templateTitle } from '$lib/templates/plan';
	import Button from '$lib/ui/Button.svelte';
	import Switch from '$lib/ui/Switch.svelte';

	type Props = {
		workout: Workout;
		/** Null offers to save the workout as a new plan instead. */
		template: Template | null;
		/** The record names the plan; the plan's own editor names the session. */
		where: 'record' | 'plan';
		onupdate?: (swaps: string[]) => Promise<void> | void;
		onsave?: () => Promise<void> | void;
		ondismiss: () => Promise<void> | void;
	};

	let { workout, template, where, onupdate, onsave, ondismiss }: Props = $props();

	const offer = $derived(
		template === null ? null : planOffer(template, workout, (id) => catalogById[id])
	);

	let answer = $state<'open' | 'updated' | 'dismissed'>('open');
	let busy = $state(false);
	let chosen = $state<string[]>([]);

	const name = $derived(template === null ? '' : templateTitle(template));

	const when = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});

	const heading = $derived(
		where === 'record' ? `This workout differed from ${name}` : 'Your last session differed'
	);

	const line = $derived.by(() => {
		const changes = offer === null ? '' : changesLine(offer.changes);

		return where === 'record' || changes === ''
			? changes
			: `${when.format(workout.startedAt)}: ${changes}`;
	});

	const shown = $derived(
		answer === 'open' && (offer === null || offer.changes.length > 0 || offer.swaps.length > 0)
	);

	async function act(run: () => Promise<void> | void, after: typeof answer) {
		busy = true;

		try {
			await run();
			answer = after;
		} finally {
			busy = false;
		}
	}
</script>

{#if answer === 'updated'}
	<p role="status" class="px-1 text-md font-bold text-ink-muted">
		{where === 'record' ? `${name} updated.` : 'Plan updated.'}
	</p>
{:else if shown}
	<section
		aria-label={template === null ? 'Save as a plan' : 'Update the plan'}
		class="flex flex-col gap-3 rounded-2xl bg-surface p-3"
	>
		<div class="flex flex-col gap-0.5 px-1">
			{#if offer === null}
				<h2 class="text-base font-extrabold text-ink">Not from a plan</h2>
				<p class="text-sm font-bold text-ink-muted">
					Save it as a new plan, at the end of your rotation.
				</p>
			{:else}
				<h2 class="text-base font-extrabold text-ink">{heading}</h2>
				{#if line !== ''}
					<p class="text-sm font-bold text-ink-muted">{line}</p>
				{/if}
			{/if}
		</div>

		{#if offer !== null}
			{#each offer.swaps as swap (swap.legId)}
				<Switch
					label={swapLabel(swap)}
					bind:checked={
						() => chosen.includes(swap.legId),
						(on) => {
							chosen = on
								? [...chosen, swap.legId]
								: chosen.filter((legId) => legId !== swap.legId);
						}
					}
					class="px-1"
				/>
			{/each}
		{/if}

		<div class="flex gap-2">
			{#if offer === null}
				<Button
					variant="primary"
					class="flex-1 sm:flex-none"
					disabled={busy}
					onclick={() => onsave !== undefined && void act(onsave, 'dismissed')}
				>
					Save as a new plan
				</Button>
			{:else}
				<Button
					variant="primary"
					class="min-w-0 flex-1 sm:flex-none"
					disabled={busy || (offer.changes.length === 0 && chosen.length === 0)}
					onclick={() =>
						onupdate !== undefined && void act(() => onupdate($state.snapshot(chosen)), 'updated')}
				>
					<span class="truncate">{where === 'record' ? `Update ${name}` : 'Update plan'}</span>
				</Button>
			{/if}

			<Button variant="secondary" disabled={busy} onclick={() => void act(ondismiss, 'dismissed')}>
				Dismiss
			</Button>
		</div>
	</section>
{/if}
