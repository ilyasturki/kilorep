<script lang="ts">
	import { untrack } from 'svelte';

	import Button from '$lib/ui/Button.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import Textarea from '$lib/ui/Textarea.svelte';

	type Props = {
		open?: boolean;
		name: string;
		note: string | undefined;
		last?: string;
		onsave: (text: string) => void;
	};

	let { open = $bindable(false), name, note, last, onsave }: Props = $props();

	let draft = $state('');
	let shown = false;

	// Saved however the sheet closes: a drawer swiped away is a lifter done typing.
	$effect(() => {
		if (open === shown) {
			return;
		}

		shown = open;

		untrack(() => {
			if (open) {
				draft = note ?? '';
			} else {
				onsave(draft);
			}
		});
	});

	let field: HTMLTextAreaElement | null = null;

	function claim(node: HTMLTextAreaElement) {
		field = node;
	}

	function caretAtEnd(): HTMLElement | null {
		field?.setSelectionRange(field.value.length, field.value.length);

		return field;
	}
</script>

<Sheet
	bind:open
	title={name}
	description="For this session. It shows again next time."
	initialFocus={caretAtEnd}
>
	<div class="flex flex-col gap-4 pt-2">
		{#if last !== undefined && note === undefined}
			<p class="px-1 text-sm font-bold text-ink-faint">
				<span class="label-caps">Last time</span>
				{last}
			</p>
		{/if}

		<Textarea
			label="Note"
			placeholder="Felt heavy, go lighter next time"
			bind:value={draft}
			{@attach claim}
		/>

		<Button variant="secondary" onclick={() => (open = false)}>Done</Button>
	</div>
</Sheet>
