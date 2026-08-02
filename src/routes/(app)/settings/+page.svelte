<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	import { createToken, logout, revokeToken } from '$lib/api/auth';
	import { ApiError, apiBase, checkServer, setApiBase } from '$lib/api/client';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	import type { PublicToken } from '$lib/api/auth';
	import type { PageProps } from './$types';

	/**
	 * Settings — behind Start's gear, per PRODUCT.md, and everything the loop
	 * never needs: the account, the server, the credentials. Three sections
	 * that each earn their place by state rather than by build flag alone:
	 *
	 * - Account and API tokens exist when someone is signed in.
	 * - Server exists only in the app build, where connecting one is a choice.
	 *   On the web the origin serving the page *is* the server, and a field for
	 *   it would be a question with one answer.
	 *
	 * Local-only in the app is all three collapsed to the connect form — the
	 * layout reads "no server" as an ordinary state and hands `user: null`, so
	 * this screen is where that state can end.
	 */
	let { data }: PageProps = $props();

	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

	// ——— Account ———

	let signOutError = $state('');
	let signOutPending = $state(false);

	// Moved here from Start, unchanged in shape: no navigation on failure — the
	// credential is still live, so /login's reverse guard would bounce straight
	// back — and `invalidateAll` on the way out so the layout's session read
	// cannot be served from cache and revive an account without a credential.
	async function signOut() {
		signOutError = '';
		signOutPending = true;

		try {
			await logout();
		} catch (error) {
			signOutError = error instanceof ApiError ? error.message : 'could not sign out, try again';
			signOutPending = false;
			return;
		}

		await goto('/login', { invalidateAll: true, replaceState: true });
	}

	// ——— Server (app build only) ———

	// Mirrored into state because `apiBase()` is module memory the template
	// cannot track; connect and disconnect keep the mirror honest.
	let server = $state(apiBase());
	let address = $state('');
	let serverError = $state('');
	let connectPending = $state(false);
	let disconnectOpen = $state(false);

	/**
	 * "gym.example.com" is what someone types; a scheme-carrying URL with no
	 * trailing slash is what `request` needs to prepend to `/api/…`. Throws on
	 * garbage, which connect() reports as its own validation error.
	 */
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
		server = base;

		// The guard takes it from here: re-reading the session against the new
		// server answers 401, and the layout's redirect carries this page along
		// as `redirectTo` — sign in, land back here, sections filled in.
		await invalidateAll();
		connectPending = false;
	}

	// Best-effort revocation before forgetting the address: a server that
	// cannot be reached to take the credential back must not be able to hold
	// the phone in the connected state. Local data is untouched either way —
	// disconnecting ends sync, not the records.
	async function disconnect() {
		try {
			await logout();
		} catch {
			// The credential outlives this on the server; its list is where it dies.
		}

		setApiBase(null);
		server = null;

		await invalidateAll();
	}

	// ——— API tokens ———

	let createOpen = $state(false);
	let label = $state('');
	let labelError = $state('');
	let createPending = $state(false);

	/** The one window in which the cleartext exists — dismissed, it is gone. */
	let minted = $state<{ token: string; label: string } | null>(null);
	let copied = $state(false);

	async function create() {
		labelError = '';

		const trimmed = label.trim();
		if (trimmed === '') {
			labelError = 'give the token a label';
			return;
		}

		createPending = true;

		try {
			const { token, credential } = await createToken(trimmed);
			minted = { token, label: credential.label };
			copied = false;
			createOpen = false;
			label = '';

			await invalidateAll();
		} catch (error) {
			labelError = error instanceof ApiError ? error.message : 'could not create the token';
		}

		createPending = false;
	}

	async function copyMinted() {
		if (minted === null) {
			return;
		}

		try {
			await navigator.clipboard.writeText(minted.token);
			copied = true;
		} catch {
			// Clipboard access refused: the cleartext is on screen to copy by hand.
		}
	}

	let revoking = $state<PublicToken | null>(null);
	let revokeOpen = $state(false);
	let revokeError = $state('');

	async function revoke() {
		if (revoking === null) {
			return;
		}

		revokeError = '';

		try {
			await revokeToken(revoking.id);
			await invalidateAll();
		} catch (error) {
			revokeError = error instanceof ApiError ? error.message : 'could not revoke the token';
		}

		revoking = null;
	}
</script>

<svelte:head>
	<title>Settings | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-6 px-3 pt-safe-t pb-4 lg:pt-0">
	<header class="flex flex-col gap-3 pt-3">
		<!-- `‹` is a character, like ListRow's `›` — measured: U+2039 present in
		     the subset. -->
		<a
			href="/workout"
			aria-label="Back to workout"
			class="grid min-h-chrome w-11 place-items-center self-start rounded-full border
				border-line text-xl leading-none text-ink-muted focus-ring hover:bg-surface-2
				active:bg-surface-2"
		>
			‹
		</a>

		<h1 class="px-1 text-2xl font-extrabold tracking-tight">Settings</h1>
	</header>

	{#if data.user}
		<section class="flex flex-col gap-3">
			<h2 class="px-1 label-caps text-ink-faint">Account</h2>

			<div class="flex max-w-sm flex-col gap-3 px-1">
				<p class="text-md break-all text-ink-muted">{data.user.email}</p>

				<Button variant="secondary" disabled={signOutPending} onclick={signOut}>
					{signOutPending ? 'Signing out…' : 'Sign out'}
				</Button>

				<div aria-live="polite">
					{#if signOutError !== ''}
						<p class="text-sm font-bold text-danger">{signOutError}</p>
					{/if}
				</div>
			</div>
		</section>
	{/if}

	{#if import.meta.env.APP_BUILD}
		<section class="flex flex-col gap-3">
			<h2 class="px-1 label-caps text-ink-faint">Server</h2>

			{#if server === null}
				<div class="flex max-w-sm flex-col gap-3 px-1">
					<p class="text-md text-pretty text-ink-muted">
						Everything lives on this phone. Connecting a self-hosted server adds sync, the web
						surface and the API.
					</p>

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
			{:else}
				<div class="flex max-w-sm flex-col gap-3 px-1">
					<p class="text-md break-all text-ink-muted">{server}</p>

					<Button variant="destructive" onclick={() => (disconnectOpen = true)}>Disconnect</Button>
				</div>

				<AlertDialog
					bind:open={disconnectOpen}
					title="Disconnect this server?"
					description="Your workouts stay on this phone. Sync and the account stop until you connect again."
					confirmLabel="Disconnect"
					onconfirm={() => void disconnect()}
				/>
			{/if}
		</section>
	{/if}

	{#if data.tokens !== null}
		<section class="flex flex-col gap-3">
			<h2 class="px-1 label-caps text-ink-faint">API tokens</h2>

			{#if minted !== null}
				<!-- Never in the row it belongs to: the list shows hashes' shadows,
				     and this is the secret itself, once. -->
				<div class="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
					<p class="text-sm font-bold text-ink-muted">
						The token for “{minted.label}”. Copy it now — it is shown this once and stored only as a
						hash.
					</p>

					<code class="rounded-xl bg-surface-2 px-3 py-2 text-sm break-all">{minted.token}</code>

					<div class="flex gap-2">
						<Button variant="chrome" caps onclick={copyMinted}>
							{copied ? 'COPIED' : 'COPY'}
						</Button>
						<Button variant="chrome" caps onclick={() => (minted = null)}>DONE</Button>
					</div>
				</div>
			{/if}

			<ul class="list-group">
				{#each data.tokens as token (token.id)}
					<li>
						<ListRow
							title={token.label}
							meta={`${token.kind} · ${token.prefix}… · ${
								token.lastUsedAt === null
									? 'never used'
									: `last used ${day.format(token.lastUsedAt)}`
							}`}
						>
							{#snippet trailing()}
								{#if token.current}
									<Badge tone="accent">This session</Badge>
								{:else}
									<Button
										variant="chrome"
										caps
										onclick={() => {
											revoking = token;
											revokeOpen = true;
										}}
									>
										REVOKE
									</Button>
								{/if}
							{/snippet}
						</ListRow>
					</li>
				{/each}
			</ul>

			<div aria-live="polite">
				{#if revokeError !== ''}
					<p class="px-1 text-sm font-bold text-danger">{revokeError}</p>
				{/if}
			</div>

			<div class="px-1">
				<Button variant="secondary" onclick={() => (createOpen = true)}>New API token</Button>
			</div>

			<Sheet
				bind:open={createOpen}
				title="New API token"
				description="Authenticates a tool against the server. The secret is shown once."
			>
				<div class="flex flex-col gap-5 pt-2">
					<Input
						label="Label"
						name="label"
						placeholder="MCP on the desk"
						bind:value={label}
						error={labelError}
					/>

					<Button variant="secondary" disabled={createPending} onclick={create}>
						{createPending ? 'Creating…' : 'Create token'}
					</Button>
				</div>
			</Sheet>

			<AlertDialog
				bind:open={revokeOpen}
				title={`Revoke “${revoking?.label ?? ''}”?`}
				description="Whatever holds this token loses access immediately. There is no undo."
				confirmLabel="Revoke"
				onconfirm={() => void revoke()}
			/>
		</section>
	{/if}
</main>
