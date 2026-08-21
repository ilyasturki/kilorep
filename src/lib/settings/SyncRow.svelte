<script lang="ts">
	import { syncedWhen } from '$lib/format/when';
	import { getStore } from '$lib/store/store';
	import { readSyncState, syncPromptly } from '$lib/sync/client';
	import { syncState } from '$lib/settings/sync.svelte';
	import type { SyncStall } from '$lib/sync/status';
	import { healsItself } from '$lib/sync/status';
	import ListRow from '$lib/ui/ListRow.svelte';

	type Props = {
		// The signed-in account, when the session probe reached the server.
		userId: string | null;
		credentialled: boolean;
	};

	let { userId, credentialled }: Props = $props();

	let owner = $state<string | null>(null);
	let now = $state(Date.now());

	$effect(() => {
		void (async () => {
			const store = await getStore();

			owner = await store.owner();

			await readSyncState(store);
		})();

		// The stamp reads in minutes; a slower tick would let it sit visibly stale
		// while the page is open.
		const tick = setInterval(() => (now = Date.now()), 20_000);

		return () => clearInterval(tick);
	});

	const status = $derived(syncState.current);

	// The store's owner, not just the probed session: a phone that cannot reach the
	// server has no `user` and is still perfectly able to try.
	const account = $derived(userId ?? owner);

	const connected = $derived(credentialled && account !== null);

	const counted = $derived(`${status.pending} ${status.pending === 1 ? 'change' : 'changes'}`);

	const stamp = $derived(status.syncedAt === null ? null : syncedWhen(status.syncedAt, now));

	type Line = { title: string; description?: string };

	// The dead ends, and what each of them needs from a person. Keyed by the stalls
	// `healsItself` rules out, so a new one of those is a missing key here rather than a
	// row that quietly falls through to a sentence about waiting.
	const STALLED: Record<Exclude<SyncStall, 'unreachable'>, string> = {
		'other-account': 'This phone holds another account’s training. Sign in as them to sync it.',
		'signed-out': 'This phone was signed out. Sign in again to send them.',
		'no-server': 'No server is connected. Name one and they go up.'
	};

	// `waiting` against `not being sent` is the whole point of the row: the first is a
	// matter of time, the second needs a person. A stall that reads like progress —
	// which a dropped credential did — is worse than saying nothing, because the phone
	// then looks exactly like one that is syncing.
	const line: Line = $derived.by(() => {
		if (!connected) {
			return {
				title: `${counted} kept here`,
				description: 'Signing in sends them to the server. Nothing is lost either way.'
			};
		}

		// Ahead of the count: a dead end is worth naming even at zero, while `waiting`
		// below is only true of records that exist.
		if (!healsItself(status.stall)) {
			return { title: `${counted} not being sent`, description: STALLED[status.stall] };
		}

		if (status.pending === 0) {
			return { title: 'Synced' };
		}

		if (status.stall === 'unreachable') {
			return {
				title: `${counted} waiting`,
				description: 'The server did not answer. Trying again on its own.'
			};
		}

		return { title: `${counted} to send` };
	});

	// A dead end is not worth tapping, and offering it would be the same lie the title
	// used to tell.
	const tappable = $derived(connected && healsItself(status.stall));

	// Nothing pending and no account is the ordinary first-run state, and a row saying
	// so would be chrome. Every stall has something to say.
	const shows = $derived(connected || status.pending > 0);

	function sync(): void {
		if (account !== null) {
			syncPromptly(account);
		}
	}
</script>

{#if shows}
	<li>
		<ListRow
			title={line.title}
			description={line.description}
			meta={status.pending === 0 && stamp !== null ? stamp : undefined}
			chevron={false}
			onclick={tappable ? sync : undefined}
		>
			{#snippet trailing()}
				{#if tappable}
					<span class="text-sm font-bold text-ink-faint">
						{status.busy ? 'Syncing…' : 'Sync now'}
					</span>
				{/if}
			{/snippet}
		</ListRow>
	</li>
{/if}
