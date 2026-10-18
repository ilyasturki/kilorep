<script lang="ts">
	import { untrack } from 'svelte';

	import type { CustomDraft } from '$lib/domain/custom';
	import CustomExerciseForm from '$lib/exercises/CustomExerciseForm.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	type Props = {
		open?: boolean;
		self?: string | null;
		initial?: CustomDraft | null;
		name?: string;
		onsave: (draft: CustomDraft) => Promise<void> | void;
	};

	let { open = $bindable(false), self = null, initial = null, name, onsave }: Props = $props();

	// A fresh form on the way in, so the exit still shows what was saved.
	let opening = $state(0);

	$effect.pre(() => {
		if (open) {
			untrack(() => (opening += 1));
		}
	});

	async function save(draft: CustomDraft) {
		await onsave(draft);
		open = false;
	}
</script>

<Sheet
	bind:open
	title={initial === null ? 'New exercise' : 'Edit exercise'}
	description={initial === null ? 'Yours alone, beside the ones that ship.' : undefined}
>
	{#key opening}
		<div class="pt-2">
			<CustomExerciseForm
				{self}
				{initial}
				{name}
				saveLabel={initial === null ? 'Create' : 'Save'}
				onsave={save}
			/>
		</div>
	{/key}
</Sheet>
