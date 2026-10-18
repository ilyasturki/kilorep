<script lang="ts">
	import { dateFormat } from '$lib/format/locale';
	import { invalidateAll } from '$app/navigation';

	import { revokeOtherTokens, setPassword } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import Section from '$lib/settings/Section.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import Switch from '$lib/ui/Switch.svelte';

	import type { Account } from '$lib/api/auth';

	type Props = {
		user: Account;
		onsignout: () => Promise<void>;
		onrevokedothers: () => void;
	};

	let { user, onsignout, onrevokedothers }: Props = $props();

	const day = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' });

	let notice = $state('');
	let signOutError = $state('');
	let signOutPending = $state(false);

	async function signOut() {
		signOutError = '';
		signOutPending = true;

		try {
			await onsignout();
		} catch (error) {
			signOutError = error instanceof ApiError ? error.message : 'could not sign out, try again';
		}

		signOutPending = false;
	}

	let othersOpen = $state(false);
	let othersPending = $state(false);
	let othersError = $state('');

	async function signOutElsewhere() {
		othersError = '';
		notice = '';
		othersPending = true;

		try {
			const revoked = await revokeOtherTokens();

			onrevokedothers();
			notice = revoked === 0 ? 'No other device was signed in.' : 'Every other device signed out.';

			await invalidateAll();
		} catch (error) {
			othersError =
				error instanceof ApiError ? error.message : 'could not sign out the other devices';
		}

		othersPending = false;
	}

	let passwordOpen = $state(false);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let currentError = $state('');
	let newError = $state('');
	let confirmError = $state('');
	let passwordFormError = $state('');
	let passwordPending = $state(false);
	let signOutOthers = $state(true);

	let needsCurrent = $derived(user.currentPasswordRequired);

	let passwordTitle = $derived(user.hasPassword ? 'Change password' : 'Set a password');

	let passwordBlurb = $derived.by(() => {
		if (user.hasPassword) {
			return needsCurrent
				? 'The one you use now, then the new one twice.'
				: 'Google is proof enough here, so the old one is not asked for — which is the way back from a password you have forgotten.';
		}

		return 'This account signs in with Google. A password adds the second way in: the login form on the web, and Settings on another phone.';
	});

	function openPassword() {
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
		currentError = '';
		newError = '';
		confirmError = '';
		passwordFormError = '';
		notice = '';
		signOutOthers = true;
		passwordOpen = true;
	}

	async function changePassword() {
		currentError = needsCurrent && currentPassword === '' ? 'enter your current password' : '';
		newError = newPassword === '' ? 'enter a new password' : '';
		confirmError = confirmPassword === newPassword ? '' : 'the two do not match';

		if (currentError !== '' || newError !== '' || confirmError !== '') {
			return;
		}

		passwordFormError = '';
		passwordPending = true;

		try {
			await setPassword(newPassword, needsCurrent ? currentPassword : null, signOutOthers);
		} catch (error) {
			passwordFormError =
				error instanceof ApiError ? error.message : 'could not change the password';
			passwordPending = false;
			return;
		}

		if (signOutOthers) {
			onrevokedothers();
		}

		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
		passwordPending = false;
		passwordOpen = false;
		notice = signOutOthers
			? 'Password changed, and every other device signed out.'
			: 'Password changed.';

		await invalidateAll();
	}
</script>

<Section title="Account">
	<li>
		<ListRow title={user.email} meta={`since ${day.format(user.createdAt)}`} />
	</li>

	<li>
		<ListRow
			title="Password"
			meta={user.hasPassword ? 'Set' : 'Not set'}
			onclick={openPassword}
			chevron
		/>
	</li>

	<li>
		<ListRow
			title={othersPending ? 'Signing out…' : 'Sign out other devices'}
			onclick={() => (othersOpen = !othersPending)}
			chevron={false}
		/>
	</li>

	<li>
		<ListRow
			title={signOutPending ? 'Signing out…' : 'Sign out'}
			onclick={() => void signOut()}
			chevron={false}
		/>
	</li>

	{#snippet footer()}
		<div aria-live="polite">
			{#if notice !== ''}
				<p class="text-sm font-bold text-ink-muted">{notice}</p>
			{/if}
			{#if signOutError !== ''}
				<p class="text-sm font-bold text-danger">{signOutError}</p>
			{/if}
			{#if othersError !== ''}
				<p class="text-sm font-bold text-danger">{othersError}</p>
			{/if}
		</div>
	{/snippet}
</Section>

<Sheet bind:open={passwordOpen} title={passwordTitle} description={passwordBlurb}>
	<div class="flex flex-col gap-5 pt-2">
		{#if needsCurrent}
			<Input
				label="Current password"
				name="current-password"
				type="password"
				autocomplete="current-password"
				bind:value={currentPassword}
				error={currentError}
			/>
		{/if}

		<Input
			label="New password"
			name="new-password"
			type="password"
			autocomplete="new-password"
			bind:value={newPassword}
			error={newError}
		/>

		<Input
			label="New password again"
			name="confirm-password"
			type="password"
			autocomplete="new-password"
			bind:value={confirmPassword}
			error={confirmError}
		/>

		<Switch
			bind:checked={signOutOthers}
			label="Sign out my other devices"
			description="Every other browser, phone and API token loses access. This one stays."
		/>

		<Button variant="secondary" disabled={passwordPending} onclick={changePassword}>
			{passwordPending ? 'Saving…' : passwordTitle}
		</Button>

		<div aria-live="polite">
			{#if passwordFormError !== ''}
				<p class="text-sm font-bold text-danger">{passwordFormError}</p>
			{/if}
		</div>
	</div>
</Sheet>

<AlertDialog
	bind:open={othersOpen}
	title="Sign out other devices?"
	description="Every other browser, phone and API token loses access. This one stays signed in."
	confirmLabel="Sign out"
	onconfirm={() => void signOutElsewhere()}
/>
