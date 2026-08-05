<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	import { createToken, revokeToken } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import Section from '$lib/settings/Section.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	import type { PublicToken } from '$lib/api/auth';

	type Props = {
		tokens: PublicToken[];
		/** The one window in which a freshly minted secret exists — dismissed, it is gone. */
		minted: { token: string; label: string } | null;
	};

	let { tokens, minted = $bindable() }: Props = $props();

	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

	let copied = $state(false);

	let createOpen = $state(false);
	let label = $state('');
	let labelError = $state('');
	let createPending = $state(false);

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

{#if minted !== null}
	<!-- Above the card and never in the row it belongs to: the list shows
	     hashes' shadows, and this is the secret itself, once. -->
	<div class="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
		<p class="text-sm font-bold text-ink-muted">
			The token for “{minted.label}”. Copy it now — it is shown this once and stored only as a hash.
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

<Section title="API tokens">
	{#snippet action()}
		<Button variant="chrome" caps onclick={() => (createOpen = true)}>NEW</Button>
	{/snippet}

	{#each tokens as token (token.id)}
		<li>
			<!-- `stacked`, because this meta is the row: which client, which prefix,
			     when it was last used. A token's label alone identifies nothing —
			     two of them read `Web` — so the line that tells them apart cannot be
			     the line that yields when the label is long. -->
			<ListRow
				stacked
				title={token.label}
				meta={`${token.kind} · ${token.prefix}… · ${
					token.lastUsedAt === null ? 'never used' : `last used ${day.format(token.lastUsedAt)}`
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

	<!-- No empty state, because there is no empty list: whatever credential asked
	     for this page is in it, wearing the badge. -->

	{#snippet footer()}
		<div aria-live="polite">
			{#if revokeError !== ''}
				<p class="text-sm font-bold text-danger">{revokeError}</p>
			{/if}
		</div>
	{/snippet}
</Section>

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
