<script lang="ts" module>
	// The card a tray group sits in — the sheet is `surface`, so its groups sink to `canvas`.
	const group = 'overflow-hidden rounded-2xl bg-canvas [&>*+*]:border-t [&>*+*]:border-line-soft';

	const kbd = 'rounded-md border border-b-2 border-line bg-surface px-1 font-semibold';
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { Dialog } from 'bits-ui';
	import { Drawer } from 'vaul-svelte';

	import { catalog, catalogById } from '$lib/catalog';
	import { MUSCLES } from '$lib/domain/exercise';
	import type { Equipment, Exercise, Muscle } from '$lib/domain/exercise';
	import { gripLabel } from '$lib/domain/grip';
	import { matchRange, searchExercises } from '$lib/domain/search';
	import type { MatchRange } from '$lib/domain/search';
	import { similarTo } from '$lib/exercises/browse';
	import type { Family } from '$lib/exercises/browse';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import { bestLabel, lastSetLabel, lastSinceLabel } from '$lib/exercises/label';
	import type { Pick, PickerFilters } from '$lib/exercises/picker';
	import { gripNamed, pickerGroups, pickOf } from '$lib/exercises/picker';
	import type { Heaviest, LastPerformed } from '$lib/store/derive';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import { drawerSlop } from '$lib/ui/drawer-slop';
	import SearchField from '$lib/ui/SearchField.svelte';
	import ArrowsLeftRight from '$lib/ui/icons/ArrowsLeftRight.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import MagnifyingGlass from '$lib/ui/icons/MagnifyingGlass.svelte';
	import Plus from '$lib/ui/icons/Plus.svelte';
	import { dockSheet } from '$lib/ui/keyboard';
	import { registerOverlay } from '$lib/ui/overlays';
	import { press } from '$lib/ui/press';
	import { wideViewport } from '$lib/ui/viewport';

	type Props = {
		open?: boolean;
		title: string;
		replacing?: Exercise | null;
		frequent?: string[];
		pinned?: { title: string; exercises: Exercise[] } | null;
		/** The exercises already in the session or plan, marked where they are listed. */
		present?: string[];
		presentLabel?: string;
		multiple?: boolean;
		verb?: string;
		lastPerformed: LastPerformed;
		heaviest?: Heaviest;
		onpick: (picks: Pick[]) => void;
	};

	let {
		open = $bindable(false),
		title,
		replacing = null,
		frequent = [],
		pinned = null,
		present = [],
		presentLabel = 'Added',
		multiple = false,
		verb = 'Add',
		lastPerformed,
		heaviest = {},
		onpick
	}: Props = $props();

	const slop = drawerSlop();

	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));

	const now = Date.now();

	// Held through the exit: the swap the sheet closes on clears `replacing`, and the sheet would
	// turn into the add sheet while it is still sliding out.
	let held: Exercise | null = null;

	const outgoing = $derived.by(() => {
		if (open) {
			held = replacing;
		}

		return held;
	});

	const swap = $derived(outgoing !== null);

	let query = $state('');
	let muscle = $state('');
	let equipment = $state('');
	let filtersOpen = $state(false);

	const EQUIPMENT = [...new Set(catalog.map((exercise) => exercise.equipment))];

	const searching = $derived(query.trim() !== '');

	const filters = $derived<PickerFilters>({
		query,
		muscle: muscle === '' ? null : (muscle as Muscle),
		equipment: equipment === '' ? null : (equipment as Equipment)
	});

	const mainPool = $derived(
		outgoing === null ? catalog : catalog.filter((exercise) => exercise.id !== outgoing.id)
	);

	const shelf = $derived.by(() => {
		if (outgoing !== null) {
			return { title: 'Similar', exercises: similarTo(catalog, outgoing) };
		}

		if (pinned !== null) {
			return pinned;
		}

		const exercises = frequent
			.map((id) => catalogById[id])
			.filter((exercise) => exercise !== undefined);

		return exercises.length === 0 ? null : { title: 'Trained most', exercises };
	});

	// The shelf ignores the chips — only a typed query prunes it, so a search never surfaces
	// a shelf of misses while a filter never blanks it.
	const shelfShown = $derived(shelf === null ? [] : searchExercises(shelf.exercises, query));

	const groups = $derived(pickerGroups(mainPool, filters, swap ? shelfShown : []));

	const shownCount = $derived(
		groups.reduce(
			(count, group) =>
				count + group.families.reduce((sum, family) => sum + 1 + family.variants.length, 0),
			0
		)
	);

	const empty = $derived(shelfShown.length === 0 && shownCount === 0);

	const presentIds = $derived(new Set(present));

	const expanded = new SvelteSet<string>();

	function toggle(familyId: string) {
		if (expanded.has(familyId)) {
			expanded.delete(familyId);
		} else {
			expanded.add(familyId);
		}
	}

	let picks = $state<Pick[]>([]);

	let active = $state(0);

	const picked = $derived(new Set(picks.map((pick) => pick.exerciseId)));

	const chosen = $derived(swap && picks.length > 0 ? catalogById[picks[0].exerciseId] : null);

	function reset() {
		query = '';
		muscle = '';
		equipment = '';
		filtersOpen = false;
		picks = [];
		active = 0;
		expanded.clear();
	}

	function choose(exercise: Exercise) {
		const pick = pickOf(exercise, query);

		if (swap) {
			picks = picks[0]?.exerciseId === exercise.id ? [] : [pick];

			return;
		}

		if (!multiple) {
			onpick([pick]);
			open = false;

			return;
		}

		picks = picked.has(exercise.id)
			? picks.filter((kept) => kept.exerciseId !== exercise.id)
			: [...picks, pick];
	}

	function commit() {
		if (picks.length === 0) {
			return;
		}

		onpick(picks);
		open = false;
	}

	// On the way in rather than the way out, so the exit still shows what was picked.
	$effect.pre(() => {
		if (open) {
			reset();
		}
	});

	const commitLabel = $derived(
		picks.length === 1 ? `${verb} 1 exercise` : `${verb} ${picks.length} exercises`
	);

	type Row = { key: string; exercise: Exercise; family: Family | null; parent: string | null };

	const ordered = $derived<Row[]>([
		...shelfShown.map((exercise) => ({
			key: `shelf:${exercise.id}`,
			exercise,
			family: null,
			parent: null
		})),
		...groups.flatMap((group) =>
			group.families.flatMap((family) => [
				{ key: `list:${family.parent.id}`, exercise: family.parent, family, parent: null },
				...(expanded.has(family.parent.id)
					? family.variants.map((exercise) => ({
							key: `list:${exercise.id}`,
							exercise,
							family: null,
							parent: family.parent.id
						}))
					: [])
			])
		)
	]);

	const activeKey = $derived(ordered[active]?.key);

	$effect(() => {
		void [query, muscle, equipment];

		active = 0;
	});

	let list = $state<HTMLElement | null>(null);

	async function reveal() {
		await tick();

		list?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' });
	}

	function move(delta: number) {
		if (ordered.length === 0) {
			return;
		}

		active = (active + delta + ordered.length) % ordered.length;

		void reveal();
	}

	function unfold(row: Row, opening: boolean) {
		if (row.parent !== null && !opening) {
			expanded.delete(row.parent);
			active = ordered.findIndex((other) => other.key === `list:${row.parent}`);
		} else if (row.family !== null && row.family.variants.length > 0) {
			if (opening) {
				expanded.add(row.family.parent.id);
			} else {
				expanded.delete(row.family.parent.id);
			}
		}

		void reveal();
	}

	let field = $state<HTMLInputElement | null>(null);

	// The caret keeps the arrows it can use: right only once it stands past the last letter,
	// left only in an empty field.
	function sideways(event: KeyboardEvent) {
		const row = ordered[active];
		const opening = event.key === 'ArrowRight';
		const free = opening ? field?.selectionStart === query.length : query === '';

		if (!free || row === undefined) {
			return;
		}

		if (row.parent !== null || (row.family?.variants.length ?? 0) > 0) {
			event.preventDefault();
			unfold(row, opening);
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			move(event.key === 'ArrowDown' ? 1 : -1);
		} else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			sideways(event);
		} else if (event.key === 'Enter') {
			event.preventDefault();

			if (event.metaKey || event.ctrlKey) {
				commit();
			} else if (ordered[active] !== undefined) {
				choose(ordered[active].exercise);
			}
		} else if (event.key === 'Escape') {
			event.preventDefault();

			if (query !== '' || muscle !== '' || equipment !== '') {
				query = '';
				muscle = '';
				equipment = '';
			} else {
				open = false;
			}
		} else if (event.key === 'Backspace' && query === '' && muscle !== '') {
			muscle = '';
		}
	}

	// The drawer docks above the keyboard itself; see Sheet.svelte for why vaul's own
	// `repositionInputs` is not that.
	let panel = $state<HTMLElement | null>(null);

	let keysUp = $state(false);

	$effect(() => (open && panel !== null ? dockSheet(panel, (up) => (keysUp = up)) : undefined));

	function metaLine(exercise: Exercise): string {
		const set = lastSetLabel(exercise, lastPerformed[exercise.id]);

		return set === undefined ? exercise.equipment : `${exercise.equipment} · ${set}`;
	}

	function swapLine(exercise: Exercise): string {
		const last = lastSetLabel(exercise, lastPerformed[exercise.id]);
		const best = heaviest[exercise.id];

		const parts = [
			...(last === undefined ? [] : [`Last ${last}`]),
			...(best === undefined ? [] : [bestLabel(exercise, best)])
		];

		return parts.length === 0 ? 'Never trained' : parts.join(' · ');
	}

	function pickName(pick: Pick): string {
		const exercise = catalogById[pick.exerciseId];
		const grip = gripLabel(exercise, pick.grip);

		if (exercise === undefined) {
			return pick.exerciseId;
		}

		return pick.grip === undefined || grip === undefined
			? exercise.name
			: `${exercise.name} · ${grip}`;
	}
</script>

{#snippet name(exercise: Exercise, match: MatchRange | null)}
	{#if match !== null}
		{exercise.name.slice(0, match.start)}<mark
			class="bg-transparent text-inherit underline decoration-2 underline-offset-2"
			>{exercise.name.slice(match.start, match.end)}</mark
		>{exercise.name.slice(match.end)}
	{:else}
		{exercise.name}
	{/if}
{/snippet}

{#snippet badge(label: string)}
	<span class="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 label-caps text-ink-muted">
		{label}
	</span>
{/snippet}

{#snippet badges(exercise: Exercise)}
	{@const named = searching ? gripNamed(exercise, query) : undefined}

	{#if searching && exercise.variantOf !== undefined}
		{@render badge('Variant')}
	{/if}

	{#if named !== undefined}
		{@render badge(gripLabel(exercise, named) ?? named)}
	{/if}

	{#if presentIds.has(exercise.id)}
		{@render badge(presentLabel)}
	{/if}
{/snippet}

{#snippet elbow()}
	<span
		aria-hidden="true"
		class="mb-2.5 ml-1 size-3 shrink-0 rounded-bl-md border-b-2 border-l-2 border-line-soft"
	></span>
{/snippet}

{#snippet mark(isPicked: boolean)}
	<span
		aria-hidden="true"
		class={[
			'grid size-6 shrink-0 place-items-center rounded-full',
			isPicked
				? swap
					? 'bg-surface text-accent-text ring-[1.5px] ring-accent-text'
					: 'bg-accent-soft text-accent-text'
				: 'border-[1.5px] border-line text-transparent'
		]}
	>
		<Check size={14} />
	</span>
{/snippet}

{#snippet expander(family: Family | null, klass: string)}
	{#if family !== null && family.variants.length > 0}
		{@const unfolded = expanded.has(family.parent.id)}

		<button
			type="button"
			aria-expanded={unfolded}
			aria-label="{unfolded ? 'Hide' : 'Show'} {family.variants.length} variants of {family.parent
				.name}"
			onclick={() => toggle(family.parent.id)}
			class={[
				'flex shrink-0 items-center justify-center gap-1 text-sm font-extrabold',
				'text-ink-muted focus-ring-inset press:bg-surface-2',
				klass
			]}
			{@attach press()}
		>
			{family.variants.length}
			<CaretDown size={14} class={unfolded ? 'rotate-180' : undefined} />
		</button>
	{:else}
		<span aria-hidden="true" class={['shrink-0', klass]}></span>
	{/if}
{/snippet}

{#snippet compare()}
	<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5">
		<div class="flex min-w-0 flex-col">
			<span class="label-caps">Current</span>
			<span class="truncate text-sm font-extrabold text-ink">{outgoing?.name}</span>
			{#if outgoing !== null}
				<span class="truncate text-xs font-bold tracking-numeral text-ink-faint">
					{swapLine(outgoing)}
				</span>
			{/if}
		</div>

		<ArrowsLeftRight size={18} class="text-ink-faint" />

		<div class="flex min-w-0 flex-col text-right">
			<span class="label-caps text-accent-text">Swap to</span>
			{#if chosen === null || chosen === undefined}
				<span class="truncate text-sm font-bold text-ink-faint">Pick a replacement</span>
			{:else}
				<span class="truncate text-sm font-extrabold text-ink">{pickName(picks[0])}</span>
				<span class="truncate text-xs font-bold tracking-numeral text-ink-faint">
					{swapLine(chosen)}
				</span>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet emptyState()}
	<div class="flex flex-col items-center gap-2 py-10 text-center">
		<MagnifyingGlass size={24} class="text-ink-faint" />
		<span class="text-md font-bold text-ink-faint">No exercise answers to that.</span>
	</div>
{/snippet}

{#snippet filterChips(pad: string)}
	<div
		class="flex shrink-0 [scrollbar-width:none] gap-2 overflow-x-auto {pad} [&::-webkit-scrollbar]:hidden"
	>
		{#if muscle !== ''}
			{@render clearChip(muscle, () => (muscle = ''))}
		{/if}

		{#if equipment !== ''}
			{@render clearChip(equipment, () => (equipment = ''))}
		{/if}

		<button
			type="button"
			aria-expanded={filtersOpen}
			onclick={() => (filtersOpen = !filtersOpen)}
			class="flex min-h-chip shrink-0 items-center gap-1.5 rounded-xl
				border-[1.5px] border-dashed border-line px-3.5 text-md font-bold
				text-ink-muted focus-ring"
			{@attach press()}
		>
			<Plus size={14} />
			Filter
		</button>
	</div>

	{#if filtersOpen}
		<div class="flex shrink-0 flex-col gap-2 {pad}">
			<ChipGroup bind:value={muscle} layout="row" label="Filter by muscle">
				{#each MUSCLES as option (option)}
					<Chip value={option}>{option}</Chip>
				{/each}
			</ChipGroup>

			<ChipGroup bind:value={equipment} layout="row" label="Filter by equipment">
				{#each EQUIPMENT as option (option)}
					<Chip value={option}>{option}</Chip>
				{/each}
			</ChipGroup>
		</div>
	{/if}
{/snippet}

{#if wideViewport.current}
	<Dialog.Root bind:open>
		<Dialog.Portal>
			<Dialog.Overlay class="overlay-scrim" />

			<Dialog.Content
				class="overlay-panel overlay-palette"
				escapeKeydownBehavior="ignore"
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					field?.focus();
				}}
				{onkeydown}
			>
				<Dialog.Title class="sr-only">{title}</Dialog.Title>

				<div class="flex min-h-15 shrink-0 items-center gap-3 border-b border-line-soft px-5">
					<MagnifyingGlass size={20} class="shrink-0 text-ink-faint" />

					<input
						bind:this={field}
						bind:value={query}
						placeholder={swap ? 'Search for a replacement' : 'Search exercises'}
						aria-label={title}
						autocomplete="off"
						autocapitalize="off"
						autocorrect="off"
						spellcheck={false}
						class="min-w-0 flex-1 border-none bg-transparent text-lg font-bold text-ink
							outline-none placeholder:text-ink-faint"
					/>

					<kbd
						class="shrink-0 rounded-md border border-b-2 border-line bg-surface px-1.5 text-xs
							font-semibold text-ink-muted"
					>
						esc
					</kbd>
				</div>

				{#if swap && outgoing !== null}
					<div
						class="flex shrink-0 items-center gap-2.5 border-b border-line-soft bg-canvas px-5 py-2"
					>
						<span class="label-caps">Replacing</span>
						<span class="text-md font-extrabold text-ink">{outgoing.name}</span>
						<span class="text-sm font-bold tracking-numeral text-ink-faint">
							{metaLine(outgoing)}
						</span>
					</div>
				{:else}
					<div class="flex shrink-0 flex-col gap-2 border-b border-line-soft py-2.5">
						{@render filterChips('px-5')}
					</div>
				{/if}

				<div bind:this={list} class="min-h-0 flex-1 overflow-y-auto pb-1.5">
					{#if empty}
						{@render emptyState()}
					{/if}

					{#if shelfShown.length > 0 && shelf !== null}
						<div class="px-5 pt-3.5 pb-1.5 label-caps">{shelf.title}</div>

						{#each shelfShown as exercise (exercise.id)}
							{@render paletteRow(exercise, `shelf:${exercise.id}`, null, false)}
						{/each}
					{/if}

					{#each groups as group (group.caption)}
						{#if group.families.length > 0}
							<div class="px-5 pt-3.5 pb-1.5 label-caps">{group.caption}</div>

							{#each group.families as family (family.parent.id)}
								{@render paletteRow(family.parent, `list:${family.parent.id}`, family, false)}

								{#if expanded.has(family.parent.id)}
									{#each family.variants as variant (variant.id)}
										{@render paletteRow(variant, `list:${variant.id}`, null, true)}
									{/each}
								{/if}
							{/each}
						{/if}
					{/each}
				</div>

				{#if swap}
					<div class="flex shrink-0 items-center gap-4 border-t border-line-soft px-4 py-3">
						<div class="min-w-0 flex-1">{@render compare()}</div>

						<Button variant="commit" compact disabled={chosen === null} onclick={commit}>
							Swap exercise
						</Button>
					</div>
				{:else if picks.length > 0}
					<div class="flex shrink-0 items-center gap-2 border-t border-line-soft px-4 py-3">
						<div
							class="flex min-w-0 flex-1 [scrollbar-width:none] gap-2
								overflow-x-auto [&::-webkit-scrollbar]:hidden"
						>
							{@render pickChips(true)}
						</div>

						<Button variant="commit" compact class="shrink-0" onclick={commit}>
							{commitLabel}
						</Button>
					</div>
				{/if}

				<div
					class="flex shrink-0 justify-center gap-4 border-t border-line-soft px-5 py-2 text-xs
						font-semibold text-ink-faint"
				>
					<span><kbd class={kbd}>↑</kbd> <kbd class={kbd}>↓</kbd> move</span>
					<span><kbd class={kbd}>→</kbd> variants</span>
					<span><kbd class={kbd}>↵</kbd> pick</span>
					{#if !swap}
						<span><kbd class={kbd}>⌘</kbd><kbd class={kbd}>↵</kbd> add & close</span>
					{/if}
				</div>
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{:else}
	<Drawer.Root bind:open repositionInputs={false}>
		<Drawer.Portal>
			<Drawer.Overlay class="overlay-scrim-drawer" />

			<Drawer.Content bind:ref={panel} class="overlay-panel overlay-drawer" {...slop}>
				<Drawer.Handle class="mt-3" />

				<div class="flex shrink-0 items-baseline justify-between gap-3 px-4 pt-3">
					<Dialog.Title class="title-panel">{title}</Dialog.Title>

					{#if !swap}
						<span class="label-caps">{shownCount} of {catalog.length} shown</span>
					{/if}
				</div>

				<div class="shrink-0 px-4 pt-2.5">
					<SearchField
						label={swap ? 'Search for a replacement' : 'Search exercises'}
						placeholder={swap ? 'Search for a replacement' : 'Search'}
						bind:value={query}
					/>
				</div>

				{#if !swap}
					<div class="flex shrink-0 flex-col gap-2.5 pt-2.5">
						{@render filterChips('px-4')}
					</div>
				{/if}

				<!-- `[&>*]:shrink-0`: a flex column that scrolls must not let its cards compress to
				     fit first — a group squeezed to nothing reads as missing, not as scrollable. -->
				<div
					class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pt-3 pb-4 [&>*]:shrink-0"
				>
					{#if empty}
						{@render emptyState()}
					{/if}

					{#if shelfShown.length > 0 && shelf !== null}
						<div class="label-caps">{shelf.title}</div>

						<div class={group}>
							{#each shelfShown as exercise (exercise.id)}
								{@render trayRow(exercise, null, false)}
							{/each}
						</div>
					{/if}

					{#each groups as group (group.caption)}
						{#if group.families.length > 0}
							<div class={['label-caps', shelfShown.length > 0 && 'pt-1.5']}>
								{group.caption}
							</div>

							<div class={group}>
								{#each group.families as family (family.parent.id)}
									{@render trayRow(family.parent, family, false)}

									{#if expanded.has(family.parent.id)}
										{#each family.variants as variant (variant.id)}
											{@render trayRow(variant, null, true)}
										{/each}
									{/if}
								{/each}
							</div>
						{/if}
					{/each}
				</div>

				<!-- Typing with nothing picked, the comparison has nothing to say and the keys have
				     already taken half the sheet; it comes back with the pick or the keys going down. -->
				{#if swap && (!keysUp || chosen !== null)}
					<div class="flex shrink-0 flex-col gap-2.5 border-t border-line-soft px-4 pt-3">
						{@render compare()}

						<Button variant="commit" class="w-full" disabled={chosen === null} onclick={commit}>
							Swap exercise
						</Button>
					</div>
				{:else if multiple && picks.length > 0}
					<div class="flex shrink-0 flex-col gap-2.5 border-t border-line-soft px-4 pt-3">
						<div
							class="flex [scrollbar-width:none] gap-2
								overflow-x-auto [&::-webkit-scrollbar]:hidden"
						>
							{@render pickChips(false)}
						</div>

						<Button variant="commit" class="w-full" onclick={commit}>{commitLabel}</Button>
					</div>
				{/if}
			</Drawer.Content>
		</Drawer.Portal>
	</Drawer.Root>
{/if}

{#snippet paletteRow(exercise: Exercise, key: string, family: Family | null, variant: boolean)}
	{@const session = lastPerformed[exercise.id]}
	{@const last = lastSetLabel(exercise, session)}
	{@const since = lastSinceLabel(session, now)}
	{@const isPicked = picked.has(exercise.id)}
	{@const isActive = key === activeKey}
	{@const match = searching ? matchRange(exercise.name, query) : null}

	<div class={['flex', isActive ? 'bg-hover' : 'hover:bg-hover']}>
		<button
			type="button"
			data-active={isActive ? '' : undefined}
			aria-pressed={isPicked}
			onclick={() => choose(exercise)}
			class={[
				'grid min-w-0 flex-1 grid-cols-[48px_minmax(0,1fr)_120px_120px_64px_44px] items-center',
				'min-h-12 text-left focus-ring-inset press:bg-surface-2',
				isPicked && swap && 'bg-accent-soft'
			]}
			{@attach press()}
		>
			<span class="flex justify-center">
				{#if !variant}
					<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-8" />
				{/if}
			</span>

			<span class="flex min-w-0 items-center gap-2 pr-2">
				{#if variant}
					{@render elbow()}
				{/if}

				<span
					class={[
						'truncate text-base tracking-tight text-ink',
						variant ? 'font-bold' : 'font-extrabold'
					]}
				>
					{@render name(exercise, match)}
				</span>

				{@render badges(exercise)}
			</span>

			<span class="truncate pr-2 text-sm font-semibold text-ink-muted">{exercise.equipment}</span>

			{#if last === undefined}
				<span class="text-md font-bold text-ink-faint">—</span>
			{:else}
				<span class="text-md font-bold tracking-numeral text-ink">{last}</span>
			{/if}

			<span
				class={[
					'text-md font-extrabold',
					since === undefined ? 'text-ink-faint' : 'text-ink-muted'
				]}
			>
				{since ?? '—'}
			</span>

			{@render mark(isPicked)}
		</button>

		{@render expander(family, 'w-12')}
	</div>
{/snippet}

{#snippet trayRow(exercise: Exercise, family: Family | null, variant: boolean)}
	{@const session = lastPerformed[exercise.id]}
	{@const since = lastSinceLabel(session, now)}
	{@const isPicked = picked.has(exercise.id)}
	{@const match = searching ? matchRange(exercise.name, query) : null}

	<div class="flex">
		<button
			type="button"
			aria-pressed={isPicked}
			onclick={() => choose(exercise)}
			data-ripple
			class={[
				'flex min-h-row min-w-0 flex-1 items-center gap-3 py-2 text-left focus-ring-inset',
				'press:bg-surface-2',
				variant ? 'pr-3 pl-4' : 'px-3',
				isPicked && swap && 'bg-accent-soft'
			]}
			{@attach press()}
		>
			{#if variant}
				{@render elbow()}
			{:else}
				<span class="size-11 shrink-0">
					<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-full" />
				</span>
			{/if}

			<span class="flex min-w-0 flex-1 flex-col">
				<span class="flex min-w-0 items-center gap-2">
					<span
						class={[
							'truncate text-base tracking-tight text-ink',
							variant ? 'font-bold' : 'font-extrabold'
						]}
					>
						{@render name(exercise, match)}
					</span>

					{@render badges(exercise)}
				</span>

				<span class="truncate text-sm font-bold tracking-numeral text-ink-faint">
					{metaLine(exercise)}
				</span>
			</span>

			<span
				class={[
					'shrink-0 text-md font-extrabold',
					since === undefined ? 'text-ink-faint' : 'text-ink-muted'
				]}
			>
				{since ?? '—'}
			</span>

			{@render mark(isPicked)}
		</button>

		{#if family !== null && family.variants.length > 0}
			{@render expander(family, 'w-12 border-l border-line-soft')}
		{/if}
	</div>
{/snippet}

{#snippet pickChips(wide: boolean)}
	{#each picks as pick (pick.exerciseId)}
		{@const exercise = catalogById[pick.exerciseId]}

		{#if exercise !== undefined}
			<button
				type="button"
				aria-label="Remove {pickName(pick)}"
				onclick={() => (picks = picks.filter((kept) => kept.exerciseId !== pick.exerciseId))}
				class={[
					'flex shrink-0 items-center rounded-[10px] bg-sunken text-sm font-bold text-ink-muted',
					'focus-ring',
					wide ? 'h-9 gap-2 px-2.5' : 'h-10 gap-1.5 px-2'
				]}
				{@attach press()}
			>
				<span class={wide ? 'size-5.5' : 'size-6'}>
					<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-full" />
				</span>
				<span class={['truncate', wide ? 'max-w-36' : 'max-w-22']}>{pickName(pick)}</span>
				<span aria-hidden="true" class="text-md">×</span>
			</button>
		{/if}
	{/each}
{/snippet}

{#snippet clearChip(label: string, clear: () => void)}
	<button
		type="button"
		aria-label="Clear {label} filter"
		onclick={clear}
		class="flex min-h-chip shrink-0 items-center gap-1.5 rounded-xl bg-surface px-3.5
			text-md font-bold text-accent-text ring-[1.5px] ring-accent-text focus-ring"
		{@attach press()}
	>
		{label}
		<span aria-hidden="true" class="opacity-70">×</span>
	</button>
{/snippet}
