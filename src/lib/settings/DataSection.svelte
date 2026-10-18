<script lang="ts">
	import { dateFormat } from '$lib/format/locale';
	import { invalidateAll } from '$app/navigation';

	import { REFUSALS, backupName, backupOf, readBackup } from '$lib/data/backup';
	import type { BackupSummary } from '$lib/data/backup';
	import { bodyweightCsv, csvNames, setsCsv } from '$lib/data/csv';
	import { deliver } from '$lib/data/deliver';
	import Section from '$lib/settings/Section.svelte';
	import { getStore } from '$lib/store/store';
	import type { ImportOutcome, StoreContents } from '$lib/store/store';
	import { syncSoon } from '$lib/sync/client';
	import Button from '$lib/ui/Button.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import { activeWorkout } from '$lib/workout/active.svelte';

	let { userId }: { userId: string | null } = $props();

	const day = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' });

	let picker = $state<HTMLInputElement | null>(null);

	let pending = $state<'json' | 'csv' | 'import' | null>(null);
	let done = $state('');
	let failure = $state('');

	// Raw: IndexedDB cannot clone a deep state proxy.
	let offered = $state.raw<{ contents: StoreContents; summary: BackupSummary } | null>(null);

	function counted(n: number, one: string, many: string): string {
		return `${n} ${n === 1 ? one : many}`;
	}

	function shownDay(date: string): string {
		const [year, month, dayOfMonth] = date.split('-').map(Number);

		return day.format(new Date(year, month - 1, dayOfMonth));
	}

	const holds = $derived.by(() => {
		if (offered === null) {
			return [];
		}

		const { summary } = offered;

		return [
			summary.workout > 0 && counted(summary.workout, 'workout', 'workouts'),
			summary.template > 0 && counted(summary.template, 'plan', 'plans'),
			summary.bodyweight > 0 && counted(summary.bodyweight, 'weigh-in', 'weigh-ins'),
			summary.preference > 0 && counted(summary.preference, 'setting', 'settings'),
			summary.session && 'A session in progress'
		].filter((line) => line !== false);
	});

	const span = $derived.by(() => {
		if (offered === null || offered.summary.from === null || offered.summary.to === null) {
			return '';
		}

		const { from, to } = offered.summary;

		return from === to ? shownDay(from) : `${shownDay(from)} – ${shownDay(to)}`;
	});

	async function run(kind: 'json' | 'csv', work: () => Promise<void>) {
		if (pending !== null) {
			return;
		}

		done = '';
		failure = '';
		pending = kind;

		try {
			await work();
		} catch {
			failure = 'could not export';
		}

		pending = null;
	}

	async function exportJson() {
		const store = await getStore();
		const now = Date.now();
		const backup = backupOf(await store.exportContents(), now);

		await deliver([
			{ name: backupName(now), mime: 'application/json', text: JSON.stringify(backup) }
		]);
	}

	async function exportCsv() {
		const store = await getStore();
		const now = Date.now();
		const names = csvNames(now);

		const [workouts, templates, bodyweight] = await Promise.all([
			store.listWorkouts(),
			store.listTemplates(),
			store.listBodyweight()
		]);

		await deliver([
			{ name: names.sets, mime: 'text/csv', text: setsCsv(workouts, templates, bodyweight) },
			{ name: names.bodyweight, mime: 'text/csv', text: bodyweightCsv(bodyweight) }
		]);
	}

	async function pick(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];

		// Cleared so the same file can be picked again after a refusal.
		event.currentTarget.value = '';

		if (file === undefined) {
			return;
		}

		done = '';
		failure = '';

		let text: string;

		try {
			text = await file.text();
		} catch {
			failure = 'could not read the file';
			return;
		}

		const read = readBackup(text);

		if (!read.ok) {
			failure = REFUSALS[read.reason];
			return;
		}

		offered = { contents: read.contents, summary: read.summary };
	}

	function outcomeLine({ written, kept, session }: ImportOutcome): string {
		const already =
			session === 'restored'
				? 'Every record was already here.'
				: 'Nothing new: this device already holds everything in the backup.';

		const lines = [
			written > 0 && `Imported ${counted(written, 'record', 'records')}.`,
			written > 0 && kept > 0 && `${kept} already here were as new or newer and stayed.`,
			written === 0 && kept > 0 && already,
			session === 'restored' && 'The session in progress is back on Train.',
			session === 'kept' && 'The session in progress it held was left out.'
		];

		return lines.filter((line) => line !== false).join(' ');
	}

	async function confirmImport() {
		if (offered === null || pending !== null) {
			return;
		}

		const { contents } = offered;

		offered = null;
		pending = 'import';

		try {
			const store = await getStore();
			const outcome = await store.importContents(
				contents,
				Date.now(),
				activeWorkout.session !== null
			);

			done = outcomeLine(outcome);

			await invalidateAll();

			if (userId !== null && outcome.written > 0) {
				syncSoon(userId);
			}
		} catch {
			failure = 'could not import the backup';
		}

		pending = null;
	}
</script>

<Section title="Data">
	<li>
		<ListRow
			title={pending === 'json' ? 'Exporting…' : 'Export JSON'}
			description="Everything on this device, ready to import again"
			onclick={() => void run('json', exportJson)}
			chevron={false}
		/>
	</li>

	<li>
		<ListRow
			title={pending === 'csv' ? 'Exporting…' : 'Export CSV'}
			description="One row per set, and body weight, for a spreadsheet"
			onclick={() => void run('csv', exportCsv)}
			chevron={false}
		/>
	</li>

	<li>
		<ListRow
			title={pending === 'import' ? 'Importing…' : 'Import a backup'}
			description="From a JSON export. Nothing here is deleted"
			onclick={() => {
				if (pending === null) {
					picker?.click();
				}
			}}
			chevron={false}
		/>

		<input
			bind:this={picker}
			type="file"
			accept={import.meta.env.APP_BUILD ? undefined : 'application/json,.json'}
			class="hidden"
			onchange={(event) => void pick(event)}
		/>
	</li>

	{#snippet footer()}
		<div aria-live="polite">
			{#if done !== ''}
				<p class="text-sm font-bold text-ink-muted">{done}</p>
			{/if}
			{#if failure !== ''}
				<p class="text-sm font-bold text-danger">{failure}</p>
			{/if}
		</div>
	{/snippet}
</Section>

<Sheet
	bind:open={
		() => offered !== null,
		(next) => {
			if (!next) {
				offered = null;
			}
		}
	}
	title="Import this backup?"
	description={span}
>
	<div class="flex flex-col gap-5 pt-2">
		<ul class="list-group">
			{#each holds as line (line)}
				<li class="flex min-h-row-dense items-center px-3 text-base font-extrabold text-ink">
					{line}
				</li>
			{/each}
		</ul>

		<p class="px-1 text-sm text-pretty text-ink-muted">
			Each record is merged into this device. Where both hold the same one, the newer copy stays.
			Nothing is deleted, and what comes in syncs like anything logged here.
		</p>

		<Button variant="secondary" onclick={() => void confirmImport()}>Import</Button>

		<Button variant="chrome" caps onclick={() => (offered = null)}>CANCEL</Button>
	</div>
</Sheet>
