<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	/**
	 * What a screen shows before it has anything to show — Workout with no
	 * session, Templates with no plans, History with no records — and the
	 * mirror of it, a workout with nothing left owed.
	 *
	 * Not a decorative afterthought. PRODUCT.md's first install "works
	 * immediately, empty and serverless", so this is literally the first screen
	 * of the app, and the action it carries is the one thing a new user is
	 * meant to do next. The action lives here, in the slot, never as a second
	 * affordance below: an empty screen is one decision, and it asks once.
	 * The slot spans the pane — the idle Workout screen stacks a template list
	 * in it, and a list cannot take a width from a wrapper sized to fit — while
	 * the inherited `text-center` keeps a lone button exactly where it was.
	 *
	 * It grows and centres itself: on a screen whose column is `min-h-full`, an
	 * empty list leaves this the only child with height to claim, so the state
	 * sits in the middle of the pane rather than huddled under the header. In a
	 * section that does not grow, `flex-1` has nothing to take and it sits in
	 * flow — which is what the in-list states (a search with no answers, an
	 * exercise not yet logged) want anyway.
	 *
	 * The copy is a statement of fact, not an apology — DESIGN.md's calm, and
	 * the same reason Finish has no ceremony.
	 */
	type Props = {
		title: string;
		description?: string;
		icon?: Snippet;
		action?: Snippet;
		class?: ClassValue;
	};

	let { title, description, icon, action, class: klass }: Props = $props();
</script>

<div
	class={['flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center', klass]}
>
	{#if icon}
		<div class="grid size-14 place-items-center rounded-full bg-surface-2 text-ink-faint">
			{@render icon()}
		</div>
	{/if}

	<div class="flex flex-col gap-1">
		<h2 class="title-panel text-ink">{title}</h2>
		{#if description}
			<p class="max-w-xs text-md font-bold text-ink-faint">{description}</p>
		{/if}
	</div>

	{#if action}
		<div class="w-full pt-1">{@render action()}</div>
	{/if}
</div>
