<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	/**
	 * What a screen shows before it has anything to show: Start with no
	 * templates, History with no workouts, Exercises with no customs, Weight
	 * with no entries — and the mirror of it, a workout with nothing left owed.
	 *
	 * Not a decorative afterthought. PRODUCT.md's first install "works
	 * immediately, empty and serverless", so this is literally the first screen
	 * of the app, and the action it carries is the one thing a new user is
	 * meant to do next.
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

<div class={['flex flex-col items-center gap-3 px-6 py-12 text-center', klass]}>
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
		<div class="pt-1">{@render action()}</div>
	{/if}
</div>
