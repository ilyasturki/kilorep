<script lang="ts" module>
	const columns =
		'grid grid-cols-[2.75rem_3.5rem_minmax(0,1fr)_7rem_5rem_7rem_2.75rem] items-center';
</script>

<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';

	import { catalogById } from '$lib/catalog';
	import { drawableMark } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import { formatSince } from '$lib/history/label';
	import { planCounts, planLine, templateTitle } from '$lib/templates/plan';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		active: Template[];
		archived: Template[];
		lastDone: Record<string, number>;
		nextId: string | null;
		onreorder: (id: string, index: number) => boolean;
	};

	let { active, archived, lastDone, nextId, onreorder }: Props = $props();

	const now = Date.now();

	// The order is hand-set and no column sorts it: the rotation Train reads is this list's
	// own sequence, and a view that reordered it would be rewriting the plan.
	const drag = new DragOrder({
		order: () => active.map((template) => template.id),
		move: (id, index) => onreorder(id, index)
	});

	const slide = $derived(prefersReducedMotion.current ? 0 : 200);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

{#snippet row(template: Template, draggable: boolean)}
	{@const mark = drawableMark(template)}
	{@const counts = planCounts(template)}
	{@const done = lastDone[template.id]}

	<a
		href="/plan/templates/{template.id}"
		data-ripple
		class="{columns} min-h-row focus-ring-inset hover:bg-hover
			pointer-fine:transition-[background-color] pointer-fine:duration-100 press:bg-surface-2"
		{@attach press()}
	>
		{#if draggable}
			<span
				role="presentation"
				aria-hidden="true"
				onpointerdown={(event) => drag.handleDown(event, template.id)}
				onpointermove={(event) => drag.move(event)}
				onpointerup={(event) => drag.up(event)}
				onpointercancel={(event) => drag.up(event)}
				class="grid h-full cursor-grab touch-none place-items-center text-ink-faint select-none"
			>
				<DotsSixVertical size={18} />
			</span>
		{:else}
			<span></span>
		{/if}

		<span class="flex justify-center">
			{#if mark !== null}
				<TemplateMark {mark} />
			{/if}
		</span>

		<span class="flex min-w-0 items-baseline gap-2 pr-3">
			<span class="truncate text-base font-extrabold tracking-tight text-ink">
				{templateTitle(template)}
			</span>

			{#if template.id === nextId}
				<span class="shrink-0"><Badge tone="accent">Up next</Badge></span>
			{/if}

			<span class="truncate text-sm font-bold text-ink-faint">
				{planLine(template, catalogById)}
			</span>
		</span>

		<span class="text-md font-bold tracking-numeral text-ink tabular-nums">
			{counts.exercises}
		</span>

		<span class="text-md font-bold tracking-numeral text-ink-muted tabular-nums">
			{counts.sets}
		</span>

		<span
			class={['text-md font-extrabold', done === undefined ? 'text-ink-faint' : 'text-ink-muted']}
		>
			{done === undefined ? '—' : formatSince(done, now)}
		</span>

		<span aria-hidden="true" class="text-center text-xl leading-none text-ink-faint">›</span>
	</a>
{/snippet}

<div class="flex flex-col gap-1.5">
	<div class="{columns} sticky top-0 z-10 -mt-1.5 bg-canvas px-1 pt-1.5 pb-2">
		<span></span>
		<span></span>
		<span class="label-caps">Template</span>
		<span class="label-caps">Exercises</span>
		<span class="label-caps">Sets</span>
		<span class="label-caps">Trained</span>
		<span></span>
	</div>

	<div class="flex flex-col overflow-hidden rounded-2xl border border-line-soft bg-surface">
		<div bind:this={drag.root} class="flex flex-col">
			{#each active as template, at (template.id)}
				{@const lifted = drag.isLifted(template.id)}

				<!-- `dragstart` is refused: the browser claims a link-drag on the first few pixels
				     and fires `pointercancel`, killing the reorder (mouse only). -->
				<div
					data-drag-id={template.id}
					role="presentation"
					animate:flip={{ duration: slide }}
					ondragstart={(event) => event.preventDefault()}
					onclickcapture={(event) => {
						if (drag.swallowClick(event)) {
							event.preventDefault();
						}
					}}
					class={[
						'border-t border-line-soft',
						at === 0 && 'border-t-0',
						lifted && 'relative z-10 bg-sunken'
					]}
				>
					<div
						style:transform={lifted ? `translateY(${drag.offset}px)` : null}
						style:transition={drag.settlingId === template.id && slide > 0 ? SETTLE : null}
						class={lifted ? 'bg-surface shadow-lg' : ''}
					>
						{@render row(template, true)}
					</div>
				</div>
			{/each}
		</div>

		<!-- Archived plans stay in the card as a band rather than behind a collapse: on a board
		     this wide they cost one row of height, and hiding them made them hard to bring back. -->
		{#if archived.length > 0}
			<div
				class={[
					'flex min-h-row items-center gap-2.5 border-t border-line-soft bg-canvas px-4',
					active.length === 0 && 'border-t-0'
				]}
			>
				<span class="text-md font-extrabold text-ink">Archived</span>
				<span class="text-xs font-extrabold text-ink-faint">{archived.length}</span>
			</div>

			{#each archived as template (template.id)}
				<div class="border-t border-line-soft opacity-60">
					{@render row(template, false)}
				</div>
			{/each}
		{/if}
	</div>
</div>
