<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';

	import { nextUp } from '$lib/domain/rotation';
	import { byRank, drawableMark, isArchived, reorder } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import { formatSince } from '$lib/history/label';
	import PlanTabs from '$lib/nav/PlanTabs.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { planMeta, templateTitle } from '$lib/templates/plan';
	import TemplateLedger from '$lib/templates/TemplateLedger.svelte';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import { press } from '$lib/ui/press';
	import { deskViewport } from '$lib/ui/viewport';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	const templates = $state(data.templates);

	const active = $derived(templates.filter((t) => !isArchived(t)).toSorted(byRank));

	const archived = $derived(templates.filter((t) => isArchived(t)).toSorted(byRank));

	const now = Date.now();

	// The same arithmetic Train's header does, said on the row it points at: the plan a lifter
	// is about to train is the one they are most likely to have come here to edit.
	const next = $derived(nextUp(active, data.lastDone));

	const grow = $derived(prefersReducedMotion.current ? 0 : 200);

	function move(id: string, index: number): boolean {
		const order = reorder(active, id, index);
		const moved = templates.find((template) => template.id === id);

		if (order === null || moved === undefined) {
			return false;
		}

		moved.order = order;

		void data.store.saveTemplate($state.snapshot(moved), Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}

		return true;
	}

	const drag = new DragOrder({ order: () => active.map((template) => template.id), move });

	const blank = `/plan/templates/${crypto.randomUUID()}`;

	let showArchived = $state(false);
</script>

<svelte:head>
	<title>Templates | Kilorep</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

{#snippet planRow(template: Template, klass?: string, draggable = false)}
	{@const mark = drawableMark(template)}
	{@const done = data.lastDone[template.id]}

	{#snippet tile()}
		{#if mark !== null}
			<TemplateMark {mark} />
		{/if}
	{/snippet}

	{#snippet upNext()}
		<Badge tone="accent">Up next</Badge>
	{/snippet}

	<!-- The chevron gives way to the third column: on a phone the row is already a link, and
	     what it cannot say for itself is when this plan was last trained. -->
	{#snippet trailing()}
		<span class={done === undefined ? 'text-ink-faint' : 'text-ink-muted'}>
			{done === undefined ? '—' : formatSince(done, now)}
		</span>

		{#if draggable}
			<span
				role="presentation"
				aria-hidden="true"
				onpointerdown={(event) => drag.handleDown(event, template.id)}
				onpointermove={(event) => drag.move(event)}
				onpointerup={(event) => drag.up(event)}
				onpointercancel={(event) => drag.up(event)}
				class="grid size-11 shrink-0 cursor-grab touch-none place-items-center
					text-ink-faint select-none"
			>
				<DotsSixVertical size={18} />
			</span>
		{/if}
	{/snippet}

	<ListRow
		title={templateTitle(template)}
		meta={planMeta(template)}
		stacked
		chevron={false}
		badge={template.id === next?.plan.id ? upNext : undefined}
		leading={mark === null ? undefined : tile}
		{trailing}
		href="/plan/templates/{template.id}"
		class={klass}
	/>
{/snippet}

{#snippet empty()}
	<EmptyState title="No templates yet" description="Plan a session once, start it every gym day.">
		{#snippet icon()}
			<Stack size={24} />
		{/snippet}
		{#snippet action()}
			<Button variant="commit" compact href={blank}>New template</Button>
		{/snippet}
	</EmptyState>
{/snippet}

<main class="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 px-3 pt-3 pb-4 lg:max-w-5xl">
	{#if deskViewport.current}
		<div class="flex items-center justify-between gap-4">
			<PlanTabs value="/plan/templates" class="w-72 shrink-0" />

			{#if templates.length > 0}
				<Button variant="chrome" href={blank}>+ New template</Button>
			{/if}
		</div>
	{:else}
		<PlanTabs value="/plan/templates" />
	{/if}

	{#if templates.length === 0}
		{@render empty()}
	{:else if deskViewport.current}
		<TemplateLedger
			{active}
			{archived}
			lastDone={data.lastDone}
			nextId={next?.plan.id ?? null}
			onreorder={move}
		/>
	{:else}
		<section class="flex flex-col gap-3">
			<div bind:this={drag.root} class="list-group">
				{#each active as template (template.id)}
					{@const lifted = drag.isLifted(template.id)}
					{@const settling = drag.settlingId === template.id}

					<!-- `dragstart` is refused: the browser claims a link-drag on the first
						     few pixels and fires `pointercancel`, killing the reorder (mouse only). -->
					<div
						data-drag-id={template.id}
						data-lifted={lifted ? '' : undefined}
						role="presentation"
						animate:flip={{ duration: grow }}
						ondragstart={(event) => event.preventDefault()}
						onpointerdown={(event) => drag.rowDown(event, template.id)}
						onpointermove={(event) => drag.move(event)}
						onpointerup={(event) => drag.up(event)}
						onpointercancel={(event) => drag.up(event)}
						onclickcapture={(event) => {
							if (drag.swallowClick(event)) {
								event.preventDefault();
							}
						}}
						class={lifted ? 'relative z-10 rounded-xl bg-sunken' : ''}
					>
						<div
							style:transform={lifted ? `translateY(${drag.offset}px) scale(1.02)` : null}
							style:transition={settling && !prefersReducedMotion.current ? SETTLE : null}
							class={lifted ? 'rounded-xl bg-surface shadow-lg' : ''}
						>
							{@render planRow(template, undefined, true)}
						</div>
					</div>
				{/each}
			</div>

			<Button variant="raised" class="w-full" href={blank}>+ New template</Button>
		</section>

		{#if archived.length > 0}
			<section class="flex flex-col gap-1">
				<button
					type="button"
					aria-expanded={showArchived}
					onclick={() => (showArchived = !showArchived)}
					class="flex min-h-chrome items-center gap-2 rounded-xl px-3 text-left
							label-caps text-ink-faint focus-ring hover:bg-hover press:bg-surface-2"
					{@attach press()}
				>
					<CaretDown size={16} class={showArchived ? 'rotate-180' : ''} />
					Archived ({archived.length})
				</button>

				{#if showArchived}
					<div transition:slide={{ duration: grow }} class="list-group">
						{#each archived as template (template.id)}
							{@render planRow(template, 'opacity-60')}
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	{/if}
</main>
