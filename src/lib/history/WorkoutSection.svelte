<script lang="ts">
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';
	import { weightStep } from '$lib/domain/exercise';
	import type { Exercise } from '$lib/domain/exercise';
	import type { SetCursor } from '$lib/domain/workout';
	import { exertionLabel } from '$lib/domain/exertion';
	import EditSet from '$lib/history/EditSet.svelte';
	import { loadModeNote } from '$lib/exercises/label';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { quickMs } from '$lib/ui/motion';
	import { press } from '$lib/ui/press';
	import SetMark from '$lib/ui/SetMark.svelte';
	import { statusOf } from '$lib/workout/groups';
	import More from '$lib/ui/icons/More.svelte';

	type Props = {
		meta: Exercise;
		entryId: string;
		cursors: SetCursor[];
		badges: string[];
		editing: boolean;
		openSetId: string | null;
		onopen: (setId: string) => void;
		onclose: () => void;
		ondraft: (setId: string, weight: number | null, reps: number | null) => void;
		onrate: (setId: string, rpe: number | null) => void;
		ontoggle: (setId: string) => void;
		onoptions: (setId: string, anchor: HTMLElement) => void;
		onexercise: (anchor: HTMLElement) => void;
		onadd: () => void;
		grip?: Snippet<[string]>;
	};

	let {
		meta,
		entryId,
		cursors,
		badges,
		editing,
		openSetId,
		onopen,
		onclose,
		ondraft,
		onrate,
		ontoggle,
		onoptions,
		onexercise,
		onadd,
		grip
	}: Props = $props();

	const note = $derived(loadModeNote(meta.loadMode));
</script>

{#snippet numbers(cursor: SetCursor)}
	{@const felt = exertionLabel(cursor.set.rpe, exertionScale.current)}

	<span
		class={[
			'flex-1 text-md tracking-numeral',
			cursor.set.completed ? 'font-extrabold text-ink' : 'font-bold text-ink-faint'
		]}
	>
		{#if cursor.set.weight !== null && cursor.set.reps !== null}
			{cursor.set.weight} × {cursor.set.reps}
		{/if}
	</span>

	{#if felt !== null}
		<span class="shrink-0 text-sm font-bold text-ink-faint">{felt}</span>
	{/if}

	{#if cursor.set.plannedReps !== null && cursor.set.reps !== cursor.set.plannedReps}
		<span class="shrink-0 text-sm font-bold text-ink-faint">
			planned {cursor.set.plannedReps}
		</span>
	{/if}
{/snippet}

{#snippet heading()}
	<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</h2>
	{#if note}
		<p class="truncate text-sm font-bold text-ink-faint">{note}</p>
	{/if}
{/snippet}

<section class="flex flex-col gap-2 rounded-2xl border border-line-soft bg-surface p-3">
	<div class="flex items-center gap-2">
		{#if editing}
			<button
				type="button"
				onclick={(e) => onexercise(e.currentTarget)}
				class="min-w-0 flex-1 rounded-xl px-1 py-1 text-left focus-ring hover:bg-hover
					press:bg-surface-2"
				{@attach press()}
			>
				{@render heading()}
			</button>
		{:else}
			<div class="min-w-0 flex-1 px-1">
				{@render heading()}
			</div>
		{/if}

		{#each badges as badge (badge)}
			<Badge>{badge}</Badge>
		{/each}

		{@render grip?.(entryId)}
	</div>

	{#each cursors as cursor (cursor.set.id)}
		{#if editing && cursor.set.id === openSetId}
			<div transition:slide={{ duration: quickMs() }}>
				{#key cursor.set.id}
					<EditSet
						{cursor}
						step={weightStep(meta.equipment)}
						ondraft={(weight, reps) => ondraft(cursor.set.id, weight, reps)}
						onrate={(rpe) => onrate(cursor.set.id, rpe)}
						ondone={onclose}
						onoptions={(anchor) => onoptions(cursor.set.id, anchor)}
					/>
				{/key}
			</div>
		{:else if editing}
			<div class="flex min-h-11 items-center gap-1">
				{#if cursor.set.type === 'warmup'}
					<div class="grid size-11 shrink-0 place-items-center">
						<SetMark status="warmup" />
					</div>
				{:else}
					<button
						type="button"
						aria-label="{cursor.set.completed ? 'Unmark' : 'Mark'} set {cursor.workingIndex +
							1} as done"
						onclick={() => ontoggle(cursor.set.id)}
						class="grid size-11 shrink-0 place-items-center rounded-full focus-ring
							hover:bg-hover press:bg-surface-2"
						{@attach press()}
					>
						<SetMark status={statusOf(cursor)} index={cursor.workingIndex + 1} />
					</button>
				{/if}

				<button
					type="button"
					onclick={() => onopen(cursor.set.id)}
					class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-2 text-left focus-ring
						hover:bg-hover press:bg-surface-2"
					{@attach press()}
				>
					{@render numbers(cursor)}
				</button>

				<button
					type="button"
					aria-label="Set options"
					onclick={(e) => onoptions(cursor.set.id, e.currentTarget)}
					class="grid size-9 shrink-0 place-items-center rounded-lg text-lg text-ink-faint
						focus-ring hover:bg-hover press:bg-surface-2"
					{@attach press()}
				>
					<More size={20} />
				</button>
			</div>
		{:else}
			<div class="flex min-h-11 items-center gap-3 px-1">
				<SetMark status={statusOf(cursor)} index={cursor.workingIndex + 1} />
				{@render numbers(cursor)}
			</div>
		{/if}
	{/each}

	{#if editing}
		<button
			type="button"
			onclick={onadd}
			class="grid min-h-11 place-items-center rounded-xl border border-dashed border-line
				text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
			{@attach press()}
		>
			<span class="label-caps">+ Add set</span>
		</button>
	{/if}
</section>
