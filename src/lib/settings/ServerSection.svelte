<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	import { logout, signInDevice } from '$lib/api/auth';
	import {
		ApiError,
		DEFAULT_SERVER,
		apiBase,
		checkServer,
		lastServer,
		setApiBase,
		setLastServer
	} from '$lib/api/client';
	import { signInWithGoogle } from '$lib/api/google-device';
	import Section from '$lib/settings/Section.svelte';
	import SyncRow from '$lib/settings/SyncRow.svelte';
	import { getStore } from '$lib/store/store';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import GoogleLogo from '$lib/ui/icons/GoogleLogo.svelte';
	import { activeWorkout } from '$lib/workout/active.svelte';

	import type { Account } from '$lib/api/auth';

	type Props = {
		user: Account | null;
		google: boolean;
		credentialled: boolean;
		server: string | null;
	};

	let { user, google, credentialled = $bindable(), server = $bindable() }: Props = $props();

	const defaultHost = new URL(DEFAULT_SERVER).host;

	let addressOpen = $state(false);
	let address = $state(lastServer() ?? '');
	let serverError = $state('');
	let connectPending = $state(false);

	function normalize(input: string): string {
		const trimmed = input.trim();
		const withScheme = /^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;

		return new URL(withScheme).href.replace(/\/$/u, '');
	}

	async function connect() {
		serverError = '';

		let base: string;
		try {
			base = normalize(address);
		} catch {
			serverError = 'enter a server address';
			return;
		}

		connectPending = true;

		try {
			await checkServer(base);
		} catch (error) {
			serverError = error instanceof ApiError ? error.message : 'could not reach the server';
			connectPending = false;
			return;
		}

		setApiBase(base);
		setLastServer(base);
		server = base;

		address = base;
		addressOpen = false;

		await invalidateAll();
		connectPending = false;
	}

	async function forget() {
		setApiBase(null);
		server = null;

		await invalidateAll();
	}

	// `server === null` means the address is the sign-in's own doing, so a failure
	// can take it back out; anything else was the user's choice and stays.
	function standTo(): void {
		if (server === null) {
			setApiBase(DEFAULT_SERVER);
		}
	}

	function standDown(): void {
		if (server === null) {
			setApiBase(null);
		}
	}

	let signInOpen = $state(false);
	let email = $state('');
	let password = $state('');
	let emailError = $state('');
	let passwordError = $state('');
	let signInError = $state('');
	let signInPending = $state(false);
	let googlePending = $state(false);

	function openSignIn() {
		emailError = '';
		passwordError = '';
		signInError = '';
		signInOpen = true;
	}

	let arriving = $state<Account | null>(null);
	let mismatchOpen = $state(false);
	let wipeOpen = $state(false);

	async function settle(account: Account) {
		credentialled = true;
		signInOpen = false;

		const store = await getStore();
		const owner = await store.owner();

		if (owner !== null && owner !== account.id) {
			arriving = account;
			mismatchOpen = true;
			return;
		}

		server = apiBase();

		await invalidateAll();
	}

	function reportSignIn(error: unknown): void {
		signInError = error instanceof ApiError ? error.message : 'could not sign in, try again';
	}

	async function signIn() {
		emailError = email.trim() === '' ? 'enter your email' : '';
		passwordError = password === '' ? 'enter your password' : '';
		if (emailError !== '' || passwordError !== '') {
			return;
		}

		signInError = '';
		signInPending = true;
		standTo();

		try {
			const account = await signInDevice(email.trim(), password);
			password = '';
			await settle(account);
		} catch (error) {
			standDown();
			reportSignIn(error);
		}

		signInPending = false;
	}

	async function withGoogle() {
		signInError = '';
		googlePending = true;
		standTo();

		try {
			await settle(await signInWithGoogle());
		} catch (error) {
			standDown();
			reportSignIn(error);
		}

		googlePending = false;
	}

	async function handOver(mode: 'adopt' | 'wipe') {
		if (arriving === null) {
			return;
		}

		const { id } = arriving;

		// Cleared before the sheet closes, so the dismissal effect below does not
		// read this as a cancellation.
		arriving = null;
		mismatchOpen = false;

		const store = await getStore();

		if (mode === 'wipe') {
			await store.wipe(id);

			activeWorkout.finish();
		} else {
			await store.adopt(id);
		}

		server = apiBase();

		await invalidateAll();
	}

	async function abandon() {
		arriving = null;
		mismatchOpen = false;
		credentialled = false;

		try {
			await logout();
		} catch {
			/* empty */
		}

		standDown();

		await invalidateAll();
	}

	$effect(() => {
		if (!mismatchOpen && arriving !== null) {
			void abandon();
		}
	});
</script>

<Section title="Server">
	{#if server !== null && credentialled}
		<li>
			<ListRow title={server} meta={user === null ? 'Unreachable' : 'Signed in'} />
		</li>

		<SyncRow userId={user?.id ?? null} credentialled />
	{:else if server !== null}
		<li>
			<ListRow title={server} meta="Not signed in" />
		</li>

		<SyncRow userId={null} credentialled={false} />

		<li>
			<ListRow title="Sign in" onclick={openSignIn} chevron />
		</li>

		<li>
			<ListRow title="Use a different server" onclick={() => void forget()} chevron />
		</li>
	{:else}
		<li>
			<ListRow title="Sign in to {defaultHost}" onclick={openSignIn} chevron />
		</li>

		<li>
			<ListRow title="Use my own server" onclick={() => (addressOpen = true)} chevron />
		</li>
	{/if}

	{#snippet footer()}
		{#if server === null}
			<p class="text-sm text-pretty text-ink-muted">
				Everything lives on this phone. Signing in adds sync, the web surface and the API — and
				takes nothing away.
			</p>
		{/if}
	{/snippet}
</Section>

<Sheet
	bind:open={signInOpen}
	title="Sign in to {server === null ? defaultHost : new URL(server).host}"
	description="Sync this phone with that server. Nothing logged here is lost either way."
>
	<div class="flex flex-col gap-5 pt-2">
		{#if google}
			<Button variant="secondary" disabled={googlePending || signInPending} onclick={withGoogle}>
				<GoogleLogo size={18} />
				{googlePending ? 'Waiting for Google…' : 'Continue with Google'}
			</Button>
		{/if}

		<Input
			label="Email"
			name="email"
			type="email"
			autocapitalize="none"
			autocorrect="off"
			spellcheck="false"
			inputmode="email"
			autocomplete="email"
			bind:value={email}
			error={emailError}
		/>

		<Input
			label="Password"
			name="password"
			type="password"
			autocomplete="current-password"
			bind:value={password}
			error={passwordError}
		/>

		<Button variant="secondary" disabled={signInPending || googlePending} onclick={signIn}>
			{signInPending ? 'Signing in…' : 'Sign in'}
		</Button>

		<div aria-live="polite">
			{#if signInError !== ''}
				<p class="text-sm font-bold text-danger">{signInError}</p>
			{/if}
		</div>
	</div>
</Sheet>

<Sheet
	bind:open={addressOpen}
	title="Use my own server"
	description="It has to be reachable from here. A LAN address works while the phone is on that network, and stops working when it leaves."
>
	<div class="flex flex-col gap-5 pt-2">
		<Input
			label="Server address"
			name="server"
			placeholder="gym.example.com"
			autocapitalize="none"
			autocorrect="off"
			spellcheck="false"
			inputmode="url"
			bind:value={address}
			error={serverError}
		/>

		<Button variant="secondary" disabled={connectPending} onclick={connect}>
			{connectPending ? 'Checking…' : 'Connect'}
		</Button>
	</div>
</Sheet>

<Sheet
	bind:open={mismatchOpen}
	title="This phone belongs to another account"
	description="Everything logged here was synced as somebody else. Choose what happens to it before {arriving?.email ??
		'the new account'} takes over."
>
	<div class="flex flex-col gap-5 pt-2">
		<div class="flex flex-col gap-2">
			<Button variant="secondary" onclick={() => void handOver('adopt')}>
				Move it to this account
			</Button>
			<p class="px-1 text-sm text-pretty text-ink-muted">
				Every workout, template and weight on this phone is copied across. The other account keeps
				its own.
			</p>
		</div>

		<div class="flex flex-col gap-2">
			<Button variant="destructive" onclick={() => (wipeOpen = true)}>Erase this phone</Button>
			<p class="px-1 text-sm text-pretty text-ink-muted">
				Local data is deleted and replaced with whatever the new account has on the server.
			</p>
		</div>

		<Button variant="chrome" caps onclick={() => void abandon()}>CANCEL</Button>
	</div>
</Sheet>

<AlertDialog
	bind:open={wipeOpen}
	title="Erase everything on this phone?"
	description="Every workout, template and body weight held here is deleted, including any that never reached a server. There is no undo."
	confirmLabel="Erase"
	onconfirm={() => void handOver('wipe')}
/>
