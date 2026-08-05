<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { drawableMark } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import { planLine, templateTitle } from '$lib/templates/plan';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	/**
	 * Which plan an exercise joins, asked from outside the template editor.
	 *
	 * The rows are the Templates tab's, down to the mark and the `planLine`
	 * under the name: this is the same list answering a different question, and
	 * a plan that described itself one way there and another way here would be
	 * two plans to a reader. What is missing is the chevron, because a tap here
	 * commits rather than travels.
	 *
	 * Archived plans are filtered by the caller, not here — a plan you have put
	 * away is not one you are adding to, and the screen that opens this sheet
	 * already needed the active count to know whether to offer the act at all.
	 *
	 * The write belongs to the caller too. This sheet holds no store and no
	 * user; it names the plans and reports the choice.
	 */
	type Props = {
		open?: boolean;
		templates: Template[];
		onpick: (template: Template) => void;
	};

	let { open = $bindable(false), templates, onpick }: Props = $props();

	function choose(template: Template) {
		onpick(template);
		open = false;
	}
</script>

<Sheet bind:open title="Add to a plan">
	<div class="list-group">
		{#each templates as template (template.id)}
			{@const mark = drawableMark(template)}

			{#snippet tile()}
				{#if mark !== null}
					<TemplateMark {mark} />
				{/if}
			{/snippet}

			<ListRow
				title={templateTitle(template)}
				meta={planLine(template, catalogById)}
				stacked
				chevron={false}
				leading={mark === null ? undefined : tile}
				onclick={() => choose(template)}
			/>
		{/each}
	</div>
</Sheet>
