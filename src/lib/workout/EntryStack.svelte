<script lang="ts" generics="Leg extends { id: string }">
	import type { Snippet } from 'svelte';

	import Badge from '$lib/ui/Badge.svelte';

	/**
	 * What says two exercises are one thing: a rail down the gutter and a seam
	 * between the legs.
	 *
	 * One component because the live pane, the plan editor and the history record
	 * were each hand-copying the same rail and the same badge-and-hairline row —
	 * and a bracket that drifted per screen would stop reading as the same
	 * pairing. The same ruling `AddRow` records for the dashed silhouette. It had
	 * already begun: the seam was inset on two screens and flush on the third
	 * before this was one component.
	 *
	 * No wrapper element. The caller's own element is the flex column — it is
	 * what the drag transforms, what `animate:flip` slides, and what carries each
	 * screen's rhythm (blocks sit further apart than plan cards) — so this
	 * renders straight into it and the rail anchors to the `relative` already
	 * there. A wrapper here would be a second box to keep in step with three.
	 *
	 * Generic over the leg, because the two trees carry different things under
	 * one: a session's leg holds cursors, a plan's holds a prescription. All this
	 * needs is the id to key on.
	 */
	type Props = {
		legs: Leg[];
		/** More than one leg. Passed rather than derived, so the caller's `Entry` stays the one authority. */
		superset: boolean;
		leg: Snippet<[Leg, number]>;
	};

	let { legs, superset, leg }: Props = $props();
</script>

<!-- Absolute, so it costs no layout and the set rows below land on exactly the
     pixels every other exercise's do. An indent would have been the cheaper
     bracket and the wrong one — the whole screen reads as one column, and a
     pair sitting 14px right of the rest would be the surprise DESIGN.md rules
     out. -->
{#if superset}
	<span aria-hidden="true" class="absolute inset-y-1 -left-2 w-0.5 rounded-full bg-accent-soft"
	></span>
{/if}

{#each legs as item, at (item.id)}
	<!-- The seam, once per join: two legs draw one, a giant set of three draws
	     two, and each says what it is standing between. The badge is the app's
	     SUPERSET pill — accent-soft, never the full accent fill, which belongs to
	     the check alone. `px-1` puts it under the exercise names, which are inset
	     by the same amount inside both card types. -->
	{#if at > 0}
		<div class="flex items-center gap-2 px-1">
			<Badge tone="accent">Superset</Badge>
			<span class="h-px flex-1 rounded-full bg-line-soft"></span>
		</div>
	{/if}

	{@render leg(item, at)}
{/each}
