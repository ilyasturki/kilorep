<script lang="ts">
	import { CUSTOM_DEFAULT_GRIP } from '$lib/domain/custom';
	import type { Exercise, Grip } from '$lib/domain/exercise';
	import { gripLabel, gripsOf } from '$lib/domain/grip';
	import { normalize } from '$lib/domain/search';
	import { exerciseCatalog } from '$lib/exercises/catalog.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		open?: boolean;
		exercise: Exercise;
		account: string | null;
		onremove?: (gripId: string) => void;
	};

	let { open = $bindable(false), exercise, account, onremove }: Props = $props();

	const label = $derived(exercise.grips?.label ?? 'Grip');

	const values = $derived(gripsOf(exercise));

	const shipped = $derived(values.filter((grip) => grip.custom !== true));

	const own = $derived(values.filter((grip) => grip.custom === true));

	// An axis that exists only for the lifter's own grips ships nothing but the default it was given.
	const made = $derived(exercise.grips?.default === CUSTOM_DEFAULT_GRIP);

	const fallback = $derived(gripLabel(exercise, null) ?? 'Standard');

	function clash(text: string, self: string | null): boolean {
		const wanted = normalize(text);

		return values.some((grip) => grip.id !== self && normalize(grip.label) === wanted);
	}

	let draft = $state('');

	const draftError = $derived(
		draft.trim() !== '' && clash(draft, null) ? `${exercise.name} already has that one.` : undefined
	);

	async function add() {
		const text = draft.trim();

		if (text === '' || draftError !== undefined) {
			return;
		}

		draft = '';

		await exerciseCatalog.addGrip(exercise.id, text, account);
	}

	async function rename(grip: Grip, field: HTMLInputElement) {
		const trimmed = field.value.trim();

		if (trimmed === '' || trimmed === grip.label || clash(trimmed, grip.id)) {
			field.value = grip.label;

			return;
		}

		await exerciseCatalog.renameGrip(grip.id, trimmed, account);
	}

	let doomed = $state<Grip | null>(null);
	let asking = $state(false);

	async function remove() {
		if (doomed === null) {
			return;
		}

		const { id } = doomed;

		await exerciseCatalog.removeGrip(id, account);

		onremove?.(id);
	}
</script>

<Sheet
	bind:open
	title="{label}s"
	description="Yours sit beside the ones that ship. A set keeps the one it was logged with."
>
	<div class="flex flex-col gap-5 pt-2">
		{#if shipped.length > 0}
			<p class="px-1 text-sm font-bold text-ink-faint">
				<span class="label-caps">{made ? 'Default' : 'Ships with it'}</span>
				{shipped.map((grip) => grip.label).join(' · ')}
			</p>
		{/if}

		{#if own.length > 0}
			<div class="flex flex-col gap-2">
				<span class="label-caps">Yours</span>

				{#each own as grip (grip.id)}
					<div class="flex items-center gap-2">
						<input
							value={grip.label}
							aria-label="Rename {grip.label}"
							maxlength={40}
							autocomplete="off"
							onchange={(event) => void rename(grip, event.currentTarget)}
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.currentTarget.blur();
								}
							}}
							class="field-box min-h-row min-w-0 flex-1 border-line focus-ring"
						/>

						<button
							type="button"
							aria-label="Delete {grip.label}"
							onclick={() => {
								doomed = grip;
								asking = true;
							}}
							class="grid size-12 shrink-0 place-items-center rounded-xl text-ink-muted
								focus-ring hover:bg-hover press:bg-surface-2"
							{@attach press()}
						>
							<Trash size={20} />
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<form
			class="flex items-end gap-2"
			onsubmit={(event) => {
				event.preventDefault();
				void add();
			}}
		>
			<Input
				label="New {label.toLowerCase()}"
				placeholder="Reverse"
				bind:value={draft}
				error={draftError}
				maxlength={40}
				autocomplete="off"
				autocapitalize="words"
				class="min-w-0 flex-1"
			/>

			<Button
				type="submit"
				variant="secondary"
				class="min-h-row"
				disabled={draft.trim() === '' || draftError !== undefined}
			>
				Add
			</Button>
		</form>

		<Button type="button" variant="secondary" onclick={() => (open = false)}>Done</Button>
	</div>
</Sheet>

<AlertDialog
	bind:open={asking}
	stacked
	title="Delete {doomed?.label ?? ''}?"
	description="Sets logged with it read as {fallback} from now on."
	confirmLabel="Delete"
	onconfirm={() => void remove()}
/>
