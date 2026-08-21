<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { drawableMark, isArchived } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import { planLine, templateTitle } from '$lib/templates/plan';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	type Props = {
		open?: boolean;
		title: string;
		templates: Template[];
		/** The plan this already names, marked in the list — and what `onclear` takes back. */
		currentId?: string | null;
		onpick: (template: Template) => void;
		onclear?: () => void;
	};

	let {
		open = $bindable(false),
		title,
		templates,
		currentId = null,
		onpick,
		onclear
	}: Props = $props();

	function choose(template: Template) {
		onpick(template);
		open = false;
	}

	function clear() {
		onclear?.();
		open = false;
	}
</script>

<Sheet bind:open {title}>
	<div class="flex flex-col gap-2">
		<div class="list-group">
			{#each templates as template (template.id)}
				{@const mark = drawableMark(template)}

				{#snippet tile()}
					{#if mark !== null}
						<TemplateMark {mark} />
					{/if}
				{/snippet}

				{#snippet flag()}
					{#if template.id === currentId}
						<Badge tone="accent">Linked</Badge>
					{:else if isArchived(template)}
						<Badge>Archived</Badge>
					{/if}
				{/snippet}

				<ListRow
					title={templateTitle(template)}
					meta={planLine(template, catalogById)}
					stacked
					chevron={false}
					leading={mark === null ? undefined : tile}
					badge={flag}
					onclick={() => choose(template)}
				/>
			{/each}
		</div>

		{#if onclear !== undefined}
			<div class="list-group">
				<ListRow
					title="No plan"
					meta="Named by its own exercises"
					stacked
					chevron={false}
					weight="bold"
					onclick={clear}
				/>
			</div>
		{/if}
	</div>
</Sheet>
