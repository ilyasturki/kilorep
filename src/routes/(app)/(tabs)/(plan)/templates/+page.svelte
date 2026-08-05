<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { planLine } from '$lib/templates/plan';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';

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
</script>

<svelte:head>
	<title>Templates | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-3 pb-4">
	{#if data.templates.length === 0}
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
			<!-- The card stops at the templates: the row below grows the list rather
			     than belonging to it, and inside the group it would read as a row
			     that had lost its title. -->
			<div class="list-group">
				{#each data.templates as template (template.id)}
					<!-- A persisted template can be nameless — named-nothing but planned-
					     something escapes the blank rule — and a row with no title reads
					     as a bug, not a choice. -->
					<!-- `stacked`, so the movements get a line of their own. `ListRow`'s
					     default packs the meta in beside the title and clips it when the
					     name leaves no room — fair where the meta is a glance's
					     convenience, and not here: this line *is* what the row has to say,
					     and a plan under a long name would be painted nowhere. -->
					<ListRow
						title={template.name.trim() === '' ? 'Untitled' : template.name}
						meta={planLine(template, catalogById)}
						stacked
						href="/templates/{template.id}"
					/>
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
	{/if}
</main>
