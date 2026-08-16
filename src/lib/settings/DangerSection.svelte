<script lang="ts">
	import { deleteAccount } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import Section from '$lib/settings/Section.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	import type { Account } from '$lib/api/auth';

	type Props = {
		user: Account;
		ondeleted: (keepLocal: boolean) => Promise<void>;
	};

	let { user, ondeleted }: Props = $props();

	let chooseOpen = $state(false);

	let confirming = $state<'keep' | 'erase' | null>(null);

	let typed = $state('');
	let typedError = $state('');
	let deleteError = $state('');
	let pending = $state(false);

	function choose(mode: 'keep' | 'erase') {
		typed = '';
		typedError = '';
		deleteError = '';
		chooseOpen = false;
		confirming = mode;
	}

	async function confirm() {
		if (confirming === null) {
			return;
		}

		if (typed.trim().toLowerCase() !== user.email) {
			typedError =
				typed.trim() === ''
					? 'retype your email address to confirm'
					: 'that is not the address on this account';
			return;
		}

		typedError = '';
		deleteError = '';
		pending = true;

		try {
			await deleteAccount(user.email);
		} catch (error) {
			deleteError = error instanceof ApiError ? error.message : 'could not delete the account';
			pending = false;
			return;
		}

		const keepLocal = confirming === 'keep';

		confirming = null;
		pending = false;

		await ondeleted(keepLocal);
	}
</script>

<Section title="Danger">
	<li>
		<ListRow
			title="Delete account"
			tone="danger"
			meta="cannot be undone"
			onclick={() => (chooseOpen = true)}
			chevron
		/>
	</li>
</Section>

<Sheet
	bind:open={chooseOpen}
	title="Delete account"
	description="Your account and everything the server holds for it are deleted. Choose what happens to the copy on this device."
>
	<div class="flex flex-col gap-5 pt-2">
		<div class="flex flex-col gap-2">
			<Button variant="destructive" onclick={() => choose('keep')}>Delete, keep this device</Button>
			<p class="px-1 text-sm text-pretty text-ink-muted">
				Every workout, template and weight stays here and keeps working, with nothing to sync to.
			</p>
		</div>

		<div class="flex flex-col gap-2">
			<Button variant="destructive" onclick={() => choose('erase')}>
				Delete and erase this device
			</Button>
			<p class="px-1 text-sm text-pretty text-ink-muted">
				Nothing survives, here or on the server — including anything that never reached one.
			</p>
		</div>

		<Button variant="chrome" caps onclick={() => (chooseOpen = false)}>CANCEL</Button>
	</div>
</Sheet>

<Sheet
	bind:open={
		() => confirming !== null,
		(next) => {
			if (!next) {
				confirming = null;
			}
		}
	}
	title={confirming === 'erase'
		? 'Delete the account and erase this device?'
		: 'Delete the account?'}
	description="There is no undo, and no way to get the data back afterwards."
>
	<div class="flex flex-col gap-5 pt-2">
		<Input
			label="Retype {user.email}"
			name="confirm-email"
			type="email"
			autocapitalize="none"
			autocorrect="off"
			spellcheck="false"
			inputmode="email"
			autocomplete="off"
			bind:value={typed}
			error={typedError}
		/>

		<Button variant="destructive" disabled={pending} onclick={confirm}>
			{pending ? 'Deleting…' : 'Delete account'}
		</Button>

		<Button variant="chrome" caps onclick={() => (confirming = null)}>CANCEL</Button>

		<div aria-live="polite">
			{#if deleteError !== ''}
				<p class="text-sm font-bold text-danger">{deleteError}</p>
			{/if}
		</div>
	</div>
</Sheet>
