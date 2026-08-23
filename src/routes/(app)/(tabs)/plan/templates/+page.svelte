<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';

	import { catalogById } from '$lib/catalog';
	import { byRank, drawableMark, isArchived, reorder } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import { syncSoon } from '$lib/sync/client';
	import { planLine, templateTitle } from '$lib/templates/plan';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';
	import { press } from '$lib/ui/press';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	const templates = $state(data.templates);

	const active = $derived(templates.filter((t) => !isArchived(t)).toSorted(byRank));

	const archived = $derived(templates.filter((t) => isArchived(t)).toSorted(byRank));

	const grow = $derived(prefersReducedMotion.current ? 0 : 200);

	const drag = new DragOrder({
		order: () => active.map((template) => template.id),
		move: (id, index) => {
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
	});

	const blank = `/plan/templates/${crypto.randomUUID()}`;

	let showArchived = $state(false);
</script>

<svelte:head>
	<title>Templates | Kilorep</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

{#snippet planRow(template: Template, klass?: string, draggable = false)}
	{@const mark = drawableMark(template)}

	{#snippet tile()}
		{#if mark !== null}
			<TemplateMark {mark} />
		{/if}
	{/snippet}

	{#snippet grip()}
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
	{/snippet}

	<ListRow
		title={templateTitle(template)}
		meta={planLine(template, catalogById)}
		stacked
		leading={mark === null ? undefined : tile}
		trailing={draggable ? grip : undefined}
		href="/plan/templates/{template.id}"
		class={klass}
	/>
{/snippet}

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-3 pb-4">
	{#if templates.length === 0}
		<EmptyState title="No templates yet" description="Plan a session once, start it every gym day.">
			{#snippet icon()}
				<Stack size={24} />
			{/snippet}
			{#snippet action()}
				<Button variant="commit" compact href={blank}>New template</Button>
			{/snippet}
		</EmptyState>
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
