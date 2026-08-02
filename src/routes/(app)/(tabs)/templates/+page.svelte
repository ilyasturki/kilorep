<script lang="ts">
	import { goto } from '$app/navigation';

	import type { Template } from '$lib/domain/template';
	import AddRow from '$lib/ui/AddRow.svelte';
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

	function newTemplate() {
		void goto(`/templates/${crypto.randomUUID()}`);
	}

	function planned(template: Template): string {
		const count = template.entries.flatMap((entry) => entry.exercises).length;

		if (count === 0) {
			return 'No exercises yet';
		}

		return count === 1 ? '1 exercise' : `${count} exercises`;
	}
</script>

<svelte:head>
	<title>Templates | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-safe-t pb-4 lg:pt-3">
	<!-- Gone from `lg` up, like Exercises': the bar above already says Templates,
	     in the tab that is currently lit. -->
	<header class="px-1 pt-6 lg:hidden">
		<h1 class="text-2xl font-extrabold tracking-tight">Templates</h1>
	</header>

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
				<Button variant="commit" compact onclick={newTemplate}>New template</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<section class="flex flex-col gap-3">
			<!-- The card stops at the templates: the AddRow below grows the list
			     rather than belonging to it, and inside the group its dashed edge
			     would read as a row that had lost its title. -->
			<div class="list-group">
				{#each data.templates as template (template.id)}
					<!-- A persisted template can be nameless — named-nothing but planned-
					     something escapes the blank rule — and a row with no title reads
					     as a bug, not a choice. -->
					<ListRow
						title={template.name.trim() === '' ? 'Untitled' : template.name}
						meta={planned(template)}
						href="/templates/{template.id}"
					/>
				{/each}
			</div>

			<AddRow label="New template" onclick={newTemplate} />
		</section>
	{/if}
</main>
