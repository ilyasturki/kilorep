<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';

	import type { Entry } from '$lib/workout/groups';
	import AddRow from '$lib/ui/AddRow.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		entries: Entry[];
		activeSetId: string | null;
		onjump: (setId: string) => void;
		onfocus: (setId: string) => void;
		oninsert: () => void;
		onreorder: (entryId: string, index: number) => void;
		ondrop?: (entryId: string) => void;
		// The one session-level act here, and the reason it is here: the panel is the only surface
		// that speaks about the workout rather than the set in front of the lifter. Beside FINISH
		// it would be two buttons a sweaty thumb reaches for, one saving and one destroying.
		ondiscard?: () => void;
	};

	let { entries, activeSetId, onjump, onfocus, oninsert, onreorder, ondrop, ondiscard }: Props =
		$props();

	const entryIds = $derived(entries.map((entry) => entry.id));

	function target(entry: Entry, go: (setId: string) => void) {
		const cursor = entry.cursors.find((c) => !c.set.completed) ?? entry.cursors.at(-1);

		if (cursor === undefined) {
			return;
		}

		go(cursor.set.id);
	}

	const drag = new DragOrder({
		order: () => entryIds,
		move: (id, index) => {
			onreorder(id, index);

			return true;
		},
		lift: (entryId) => {
			const entry = entries.find((candidate) => candidate.id === entryId);

			if (entry !== undefined) {
				target(entry, onfocus);
			}
		},
		drop: (entryId) => ondrop?.(entryId)
	});

	function select(event: MouseEvent, entry: Entry) {
		if (drag.swallowClick(event)) {
			return;
		}

		target(entry, onjump);
	}

	const slide = $derived(prefersReducedMotion.current ? 0 : 200);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

<div class="flex flex-col gap-3">
	<div bind:this={drag.root} class="flex flex-col gap-1">
		{#each entries as entry (entry.id)}
			{@const lifted = drag.isLifted(entry.id)}
			{@const here = entry.cursors.some((c) => c.set.id === activeSetId)}
			{@const done = entry.cursors.every((c) => c.set.completed)}

			<div
				data-drag-id={entry.id}
				animate:flip={{ duration: slide }}
				class={lifted ? 'relative z-10 rounded-xl bg-sunken' : ''}
			>
				<div
					style:transform={lifted ? `translateY(${drag.offset}px) scale(1.02)` : null}
					style:transition={drag.settlingId === entry.id && slide > 0 ? SETTLE : null}
					class={[
						'flex min-h-row items-center gap-1 rounded-xl pr-1 pl-3',
						'pointer-fine:transition-[background-color] pointer-fine:duration-100',
						lifted ? 'bg-surface shadow-lg' : 'hover:bg-hover press:bg-surface-2'
					]}
					{@attach press()}
				>
					<button
						type="button"
						onclick={(event) => select(event, entry)}
						class="flex min-w-0 flex-1 items-center gap-3 py-2 text-left focus-ring-inset"
					>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-base font-extrabold tracking-tight text-ink">
								{entry.title}
							</span>
							<span class="block truncate text-sm font-bold text-ink-faint">
								{entry.superset ? 'Superset' : entry.legs[0].meta.equipment}
							</span>
						</span>

						<span class="flex shrink-0 items-center gap-2 text-md font-extrabold text-ink-muted">
							{#if here}
								<Badge tone="accent">Now</Badge>
							{:else if done}
								<Badge>Done</Badge>
							{/if}
						</span>
					</button>

					<!-- The grip and nothing else, and `data-vaul-no-drag` is why: this list lives in a
					     drawer whose body belongs to drag-to-dismiss, and vaul latches on the first
					     pixel of travel — long before a 500ms hold could lift a row. So the grip is
					     fenced off for reordering and every other pixel of the row closes the drawer. -->
					<span
						role="presentation"
						aria-hidden="true"
						data-vaul-no-drag
						onpointerdown={(event) => drag.handleDown(event, entry.id)}
						onpointermove={(event) => drag.move(event)}
						onpointerup={(event) => drag.up(event)}
						onpointercancel={(event) => drag.up(event)}
						class="grid size-11 shrink-0 cursor-grab touch-none place-items-center
							text-ink-faint select-none"
					>
						<DotsSixVertical size={18} />
					</span>
				</div>
			</div>
		{/each}

		<AddRow label="Add exercise" onclick={oninsert} />
	</div>

	{#if ondiscard !== undefined}
		<Button variant="destructive" class="w-full" onclick={ondiscard}>
			<Trash size={20} />
			Discard workout
		</Button>
	{/if}
</div>
