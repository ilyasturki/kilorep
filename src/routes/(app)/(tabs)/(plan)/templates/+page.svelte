<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';

	import { catalogById } from '$lib/catalog';
	import { byRank, drawableMark, isArchived, reorder } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import { syncSoon } from '$lib/sync/client';
	import { planLine } from '$lib/templates/plan';
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

	/**
	 * The template list as its own tab — the planning surface's front door,
	 * carried over from the Start page when that page folded into the Workout
	 * tab. A list read standing still earns an address of its own; the one
	 * button pressed mid-stride lives on Workout.
	 *
	 * A template row opens its editor, where Start lives; it does not start the
	 * workout itself. The immediate-start rule was weighed and retired — see
	 * PRODUCT.md's Start section — because one row cannot honestly carry both
	 * "open this plan" and "begin lifting now", and a mis-tap that starts a
	 * workout costs more than the tap it saved.
	 *
	 * "New template" navigates before any record exists: the editor owns the
	 * blank-birth rule and writes nothing until the plan says something, so a
	 * mis-tap here leaves no junk behind. The id is minted now because the
	 * route is the id.
	 */
	let { data }: PageProps = $props();

	// The page owns the live list, the load's copy is the starting point — the
	// same bargain the editor strikes with its tree. A drag has to reorder the
	// rows under the finger before the write lands, and re-reading the load
	// would settle them a round trip late.
	// svelte-ignore state_referenced_locally
	const templates = $state(data.templates);

	/**
	 * Two lists off one array, both sorted the way the store sorted it.
	 *
	 * Re-sorted here and not trusted from the load, because a drag mutates a
	 * rank in place: the array keeps its old positions and only `byRank` knows
	 * the new ones.
	 */
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

	/**
	 * The address of the template nobody has written yet.
	 *
	 * A link and not a button, so the press is a navigation the browser
	 * performs — which is what makes it middle-clickable, openable in a new tab,
	 * and reachable by the same keys every other row on this screen answers to.
	 * That costs one thing: an anchor has to know where it goes before it is
	 * pressed, so the id is minted here at mount rather than inside a handler.
	 *
	 * Which the blank-birth rule makes free. An id that is visited and abandoned
	 * leaves no record, and one that is never visited leaves less; the page
	 * remounts on every return to this tab, so the next new template is a new
	 * id without anything having to reset one.
	 */
	const blank = `/templates/${crypto.randomUUID()}`;

	let showArchived = $state(false);

	function title(template: Template): string {
		return template.name.trim() === '' ? 'Untitled' : template.name;
	}
</script>

<svelte:head>
	<title>Templates | Kilorep</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

<!-- One row, drawn the same way in both lists: the archived half is the active
     half dimmed, and a plan that reads differently once it is put away reads as
     a different plan.

     A persisted template can be nameless — named-nothing but planned-something
     escapes the blank rule — and a row with no title reads as a bug, not a
     choice.

     `stacked`, so the movements get a line of their own. `ListRow`'s default
     packs the meta in beside the title and clips it when the name leaves no
     room — fair where the meta is a glance's convenience, and not here: this
     line *is* what the row has to say, and a plan under a long name would be
     painted nowhere. -->
{#snippet planRow(template: Template, klass?: string, chevron?: boolean)}
	{@const mark = drawableMark(template)}

	{#snippet tile()}
		{#if mark !== null}
			<TemplateMark {mark} />
		{/if}
	{/snippet}

	<ListRow
		title={title(template)}
		meta={planLine(template, catalogById)}
		stacked
		{chevron}
		leading={mark === null ? undefined : tile}
		href="/templates/{template.id}"
		class={klass}
	/>
{/snippet}

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-3 pb-4">
	{#if templates.length === 0}
		<!-- Centred in the pane, action inside — an empty tab is one decision,
		     and the dashed grow-by-one row waits until there is a list to grow. -->
		<EmptyState title="No templates yet" description="Plan a session once, start it every gym day.">
			{#snippet icon()}
				<Stack size={24} />
			{/snippet}
			{#snippet action()}
				<!-- Compact: the commit at planning scale — the gym-sized slab
				     belongs to the floor, and this screen is not it. -->
				<Button variant="commit" compact href={blank}>New template</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<section class="flex flex-col gap-3">
			<!-- Separate rows on a gap, not the single `list-group` card this used to
			     be. The card clips — `overflow: hidden` is what gives it one outline
			     and one set of corners — and a lifted row is a card that has left the
			     page, translated past its neighbours with a shadow under it. Inside
			     the group it was sheared off at the edge mid-drag. Every reorderable
			     list in the app wears this shape for the same reason; `PlanList` is
			     the other one. -->
			<div bind:this={drag.root} class="flex flex-col gap-1">
				{#each active as template (template.id)}
					{@const lifted = drag.isLifted(template.id)}
					{@const settling = drag.settlingId === template.id}

					<div
						data-drag-id={template.id}
						animate:flip={{ duration: grow }}
						class={lifted ? 'relative z-10 rounded-xl bg-sunken' : ''}
					>
						<div
							style:transform={lifted ? `translateY(${drag.offset}px) scale(1.02)` : null}
							style:transition={settling && !prefersReducedMotion.current ? SETTLE : null}
							class={[
								'flex items-center gap-1 rounded-xl pr-1',
								lifted ? 'bg-surface shadow-lg' : ''
							]}
						>
							<!-- The pointer handlers sit on a wrapper rather than on the row,
							     because the row is an anchor and stays one: middle-click and
							     open-in-new-tab are the whole reason a template row is a link,
							     and a `<button>` with a `goto` would quietly drop both. Pointer
							     events bubble, so the wrapper hears the press that lands on the
							     anchor; the click is caught on the way down and cancelled when
							     a drag has already spent it, which is what stops a reorder from
							     also opening the plan it moved. -->
							<!-- `presentation`, because this box is nothing but a place to hear
							     the pointer from: the row inside it is the anchor, keeps its
							     own role and its own name, and is what a keyboard and a screen
							     reader reach. Same declaration the grip beside it makes. -->
							<div
								role="presentation"
								class="min-w-0 flex-1"
								onpointerdown={(event) => drag.rowDown(event, template.id)}
								onpointermove={(event) => drag.move(event)}
								onpointerup={(event) => drag.up(event)}
								onpointercancel={(event) => drag.up(event)}
								onclickcapture={(event) => {
									if (drag.swallowClick(event)) {
										event.preventDefault();
									}
								}}
							>
								<!-- The chevron goes where the grip arrives. Both say "this row
								     is yours to act on" and two marks saying it at opposite ends
								     of one row is the noise, not the reassurance. -->
								{@render planRow(template, undefined, false)}
							</div>

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
						</div>
					</div>
				{/each}
			</div>

			<!-- `raised` and not the dashed `AddRow` this used to be: standing on the
			     canvas under a solid card of rows, a dashed hairline was the quietest
			     thing on a screen whose whole job is starting a new plan. Filled with
			     `surface` — the colour the card above it already is — it weighs what
			     the rows weigh, and the accent stays out of it: nothing on this screen
			     logs a set. See `Button`'s `raised` for why the dashed silhouette is
			     still right everywhere it sits *inside* a card. -->
			<Button variant="raised" class="w-full" href={blank}>+ New template</Button>
		</section>

		{#if archived.length > 0}
			<!-- Under the new-template button, not above it: what is put away ranks
			     below the one act this screen exists for. Collapsed, because the
			     count is the whole of what an archived plan has to say until it is
			     asked for. -->
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
					<div transition:slide={{ duration: grow }} class="flex flex-col gap-1">
						{#each archived as template (template.id)}
							<!-- Still a link to its editor, which is where the way back out
							     lives. Not draggable: order is a property of the list you
							     choose from, and this is the list you have stopped choosing
							     from. -->
							{@render planRow(template, 'opacity-60')}
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	{/if}
</main>
