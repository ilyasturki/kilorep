<script lang="ts">
	import { deleteAccount } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import Section from '$lib/settings/Section.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	import type { Account } from '$lib/api/auth';

	/**
	 * Deleting the account: the one irreversible thing this app can be asked to
	 * do, and the reason this section is at the foot of the page in a heading of
	 * its own rather than as a fourth row under Account.
	 *
	 * Two acts, not one, and the sheet asks which before it asks whether. The
	 * server side is the same either way — the row goes and the cascade takes
	 * every record with it — and what differs is the copy on this device, which
	 * is data the server never had a claim on. Somebody deleting an account to
	 * stop syncing is not the same person as somebody deleting one to be gone,
	 * and the difference is not something a default can guess.
	 *
	 * The confirmation stands in front of the chosen one rather than the choice,
	 * so the address is retyped in front of a named outcome. `scripts/account.ts`
	 * asks for the same thing at a terminal.
	 */
	type Props = {
		user: Account;
		/**
		 * The aftermath, which is the page's: what happens to the store, to the
		 * connection, and to where the user ends up. Called only once the server
		 * has confirmed the account is gone.
		 */
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

		// Closed before the aftermath, which ends in a navigation on the web and
		// in a reload of this very screen on the phone. A sheet still open across
		// either is a panel over a page that has moved on.
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

<!-- A Sheet and not the AlertDialog the other confirmations use: this one has a
     field to fill in, and AlertDialog is two buttons under a sentence by
     design. -->
<Sheet
	bind:open={
		() => confirming !== null,
		(next) => {
			// Dismissal is a cancellation and nothing else — there is nothing in
			// flight to abandon, only a decision not yet made.
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

		<!-- Live whatever is in the field rather than disabled until it matches: an
		     outlined button has no disabled look to wear, so it reads as pressable
		     and says nothing about why. The error under the field is the answer. -->
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
