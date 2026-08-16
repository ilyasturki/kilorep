<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { drawableMark } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import { planLine, templateTitle } from '$lib/templates/plan';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

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
