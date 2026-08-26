<script lang="ts" module>
	// The card a tray group sits in — the sheet is `surface`, so its groups sink to `canvas`.
	const group = 'overflow-hidden rounded-2xl bg-canvas [&>*+*]:border-t [&>*+*]:border-line-soft';

	const kbd = 'rounded-md border border-b-2 border-line bg-surface px-1 font-semibold';
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { Drawer } from 'vaul-svelte';

	import { catalog, catalogById } from '$lib/catalog';
	import { MUSCLES } from '$lib/domain/exercise';
	import type { Equipment, Exercise, Muscle } from '$lib/domain/exercise';
	import { matchRange, searchExercises } from '$lib/domain/search';
	import type { MatchRange } from '$lib/domain/search';
	import { sections, similarTo } from '$lib/exercises/browse';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import { lastSetLabel, lastSinceLabel, setLabel } from '$lib/exercises/label';
	import type { PickerFilters } from '$lib/exercises/picker';
	import { shownCaption, shownExercises } from '$lib/exercises/picker';
	import type { Heaviest, LastPerformed } from '$lib/store/derive';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';
	import ArrowsLeftRight from '$lib/ui/icons/ArrowsLeftRight.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import MagnifyingGlass from '$lib/ui/icons/MagnifyingGlass.svelte';
	import Plus from '$lib/ui/icons/Plus.svelte';
	import type { Pane } from '$lib/ui/keyboard';
	import { dockBottom, keyboardUp, visiblePane, watchVisiblePane } from '$lib/ui/keyboard';
	import { registerOverlay } from '$lib/ui/overlays';
	import { press } from '$lib/ui/press';
	import { wideViewport } from '$lib/ui/viewport';

	type Props = {
		open?: boolean;
		title: string;
		replacing?: Exercise | null;
		frequent?: string[];
		pinned?: { title: string; exercises: Exercise[] } | null;
		multiple?: boolean;
		verb?: string;
		lastPerformed: LastPerformed;
		heaviest?: Heaviest;
		onpick: (exerciseIds: string[]) => void;
	};

	let {
		open = $bindable(false),
		title,
		replacing = null,
		frequent = [],
		pinned = null,
		multiple = false,
		verb = 'Add',
		lastPerformed,
		heaviest = {},
		onpick
	}: Props = $props();

	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));

	const now = Date.now();

	const swap = $derived(replacing !== null);

	let query = $state('');
	let muscle = $state('');
	let equipment = $state('');
	let filtersOpen = $state(false);

	const EQUIPMENT = [...new Set(catalog.map((exercise) => exercise.equipment))];

	const searching = $derived(query.trim() !== '');
	const chipped = $derived(muscle !== '' || equipment !== '');

	const filters = $derived<PickerFilters>({
		query,
		muscle: muscle === '' ? null : (muscle as Muscle),
		equipment: equipment === '' ? null : (equipment as Equipment)
	});

	const mainPool = $derived(
		replacing === null ? catalog : catalog.filter((exercise) => exercise.id !== replacing.id)
	);

	const shelf = $derived.by(() => {
		if (replacing !== null) {
			return { title: 'Similar', exercises: similarTo(catalog, replacing) };
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

	const groups = $derived.by((): { caption: string; exercises: Exercise[] }[] => {
		if (searching || chipped) {
			return [
				{
					caption: searching ? 'All matches' : shownCaption(filters),
					exercises: shownExercises(mainPool, filters)
				}
			];
		}

		return sections(mainPool).map((section) => ({
			caption: section.muscle,
			exercises: section.families.flatMap((family) => [family.parent, ...family.variants])
		}));
	});

	const shownCount = $derived(groups.reduce((count, group) => count + group.exercises.length, 0));

	const empty = $derived(shelfShown.length === 0 && shownCount === 0);

	let picks = $state<string[]>([]);

	let active = $state(0);

	const picked = $derived(new Set(picks));

	const chosen = $derived(swap && picks.length > 0 ? catalogById[picks[0]] : null);

	function reset() {
		query = '';
		muscle = '';
		equipment = '';
		filtersOpen = false;
		picks = [];
		active = 0;
	}

	function choose(exercise: Exercise) {
		if (swap) {
			picks = picks[0] === exercise.id ? [] : [exercise.id];

			return;
		}

		if (!multiple) {
			onpick([exercise.id]);
			reset();
			open = false;

			return;
		}

		picks = picks.includes(exercise.id)
			? picks.filter((id) => id !== exercise.id)
			: [...picks, exercise.id];
	}

	function commit() {
		if (picks.length === 0) {
			return;
		}

		onpick(picks);
		reset();
		open = false;
	}

	$effect(() => {
		if (!open) {
			reset();
		}
	});

	const commitLabel = $derived(
		picks.length === 1 ? `${verb} 1 exercise` : `${verb} ${picks.length} exercises`
	);

	const ordered = $derived([
		...shelfShown.map((exercise) => ({ key: `shelf:${exercise.id}`, exercise })),
		...groups.flatMap((group) =>
			group.exercises.map((exercise) => ({ key: `list:${exercise.id}`, exercise }))
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

	const MUSCLE_CYCLE = ['', ...MUSCLES];

	function cycleMuscle(delta: number) {
		const at = MUSCLE_CYCLE.indexOf(muscle);

		muscle = MUSCLE_CYCLE[(at + delta + MUSCLE_CYCLE.length) % MUSCLE_CYCLE.length];
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			move(event.key === 'ArrowDown' ? 1 : -1);
		} else if (event.key === 'Enter') {
			event.preventDefault();

			if (event.metaKey || event.ctrlKey) {
				commit();
			} else if (ordered[active] !== undefined) {
				choose(ordered[active].exercise);
			}
		} else if (event.key === 'Tab') {
			event.preventDefault();
			cycleMuscle(event.shiftKey ? -1 : 1);
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

	let field = $state<HTMLInputElement | null>(null);

	// The drawer docks above the keyboard itself; see Sheet.svelte for why vaul's own
	// `repositionInputs` is not that.
	let panel = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!open || panel === null) {
			return;
		}

		const node = panel;

		const dock = (pane: Pane): void => {
			if (keyboardUp(pane)) {
				node.style.setProperty('--sheet-keys', `${dockBottom(pane)}px`);
				node.style.setProperty('--sheet-pane', `${pane.height}px`);
			} else {
				node.style.removeProperty('--sheet-keys');
				node.style.removeProperty('--sheet-pane');
			}

			node.style.removeProperty('transition');
		};

		dock(visiblePane());

		return watchVisiblePane(dock);
	});

	function metaLine(exercise: Exercise): string {
		const set = lastSetLabel(exercise, lastPerformed[exercise.id]);

		return set === undefined ? exercise.equipment : `${exercise.equipment} · ${set}`;
	}

	function swapLine(exercise: Exercise): string {
		const last = lastSetLabel(exercise, lastPerformed[exercise.id]);
		const best = heaviest[exercise.id];

		const parts = [
			...(last === undefined ? [] : [`Last ${last}`]),
			...(best === undefined ? [] : [`Best ${setLabel(exercise, best)}`])
		];

		return parts.length === 0 ? 'Never trained' : parts.join(' · ');
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

{#snippet variantBadge()}
	<span class="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 label-caps text-ink-muted">
		Variant
	</span>
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

{#snippet compare()}
	<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5">
		<div class="flex min-w-0 flex-col">
			<span class="label-caps">Current</span>
			<span class="truncate text-sm font-extrabold text-ink">{replacing?.name}</span>
			{#if replacing !== null}
				<span class="truncate text-xs font-bold tracking-numeral text-ink-faint">
					{swapLine(replacing)}
				</span>
			{/if}
		</div>

		<ArrowsLeftRight size={18} class="text-ink-faint" />

		<div class="flex min-w-0 flex-col text-right">
			<span class="label-caps text-accent-text">Swap to</span>
			{#if chosen === null}
				<span class="truncate text-sm font-bold text-ink-faint">Pick a replacement</span>
			{:else}
				<span class="truncate text-sm font-extrabold text-ink">{chosen.name}</span>
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

					{#if muscle !== ''}
						<button
							type="button"
							aria-label="Clear {muscle} filter"
							onclick={() => (muscle = '')}
							class="flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-accent-soft px-2
								text-sm font-extrabold text-accent-text focus-ring"
							{@attach press()}
						>
							{muscle}
							<span aria-hidden="true" class="text-md font-bold opacity-70">×</span>
						</button>
					{/if}

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

				{#if swap && replacing !== null}
					<div
						class="flex shrink-0 items-center gap-2.5 border-b border-line-soft bg-canvas px-5 py-2"
					>
						<span class="label-caps">Replacing</span>
						<span class="text-md font-extrabold text-ink">{replacing.name}</span>
						<span class="text-sm font-bold tracking-numeral text-ink-faint">
							{metaLine(replacing)}
						</span>
					</div>
				{/if}

				<div bind:this={list} class="min-h-0 flex-1 overflow-y-auto pb-1.5">
					{#if empty}
						{@render emptyState()}
					{/if}

					{#if shelfShown.length > 0 && shelf !== null}
						<div class="px-5 pt-3.5 pb-1.5 label-caps">{shelf.title}</div>

						{#each shelfShown as exercise (exercise.id)}
							{@render paletteRow(exercise, `shelf:${exercise.id}`)}
						{/each}
					{/if}

					{#each groups as group (group.caption)}
						{#if group.exercises.length > 0}
							<div class="px-5 pt-3.5 pb-1.5 label-caps">{group.caption}</div>

							{#each group.exercises as exercise (exercise.id)}
								{@render paletteRow(exercise, `list:${exercise.id}`)}
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
					<span><kbd class={kbd}>↵</kbd> pick</span>
					<span><kbd class={kbd}>⇥</kbd> filter muscle</span>
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

			<Drawer.Content bind:ref={panel} class="overlay-panel overlay-drawer">
				<Drawer.Handle class="mt-3" />

				<div class="flex shrink-0 items-baseline justify-between gap-3 px-4 pt-3">
					<Dialog.Title class="title-panel">{title}</Dialog.Title>

					{#if !swap}
						<span class="label-caps">{shownCount} of {catalog.length} shown</span>
					{/if}
				</div>

				{#if swap && replacing !== null}
					<div class="shrink-0 px-4 pt-2.5">
						<div class="flex items-center gap-3 rounded-2xl bg-canvas p-3">
							<span class="size-11 shrink-0">
								<ExerciseIllustration id={replacing.id} name={replacing.name} class="size-full" />
							</span>
							<div class="flex min-w-0 flex-col">
								<span class="label-caps">Replacing</span>
								<span class="truncate text-base font-extrabold text-ink">{replacing.name}</span>
								<span class="truncate text-sm font-bold tracking-numeral text-ink-faint">
									{metaLine(replacing)}
								</span>
							</div>
						</div>
					</div>
				{/if}

				<div class="shrink-0 px-4 pt-2.5">
					<SearchField
						label={swap ? 'Search for a replacement' : 'Search exercises'}
						placeholder={swap ? 'Search for a replacement' : 'Search'}
						bind:value={query}
					/>
				</div>

				{#if !swap}
					<div
						class="flex shrink-0 [scrollbar-width:none] gap-2 overflow-x-auto px-4
							pt-2.5 [&::-webkit-scrollbar]:hidden"
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
						<div class="flex shrink-0 flex-col gap-2 px-4 pt-2.5">
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
								{@render trayRow(exercise)}
							{/each}
						</div>
					{/if}

					{#each groups as group (group.caption)}
						{#if group.exercises.length > 0}
							<div class={['label-caps', shelfShown.length > 0 && 'pt-1.5']}>
								{group.caption}
							</div>

							<div class={group}>
								{#each group.exercises as exercise (exercise.id)}
									{@render trayRow(exercise)}
								{/each}
							</div>
						{/if}
					{/each}
				</div>

				{#if swap}
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

{#snippet paletteRow(exercise: Exercise, key: string)}
	{@const session = lastPerformed[exercise.id]}
	{@const last = lastSetLabel(exercise, session)}
	{@const since = lastSinceLabel(session, now)}
	{@const isPicked = picked.has(exercise.id)}
	{@const isActive = key === activeKey}
	{@const match = searching ? matchRange(exercise.name, query) : null}

	<button
		type="button"
		data-active={isActive ? '' : undefined}
		aria-pressed={isPicked}
		onclick={() => choose(exercise)}
		class={[
			'grid w-full grid-cols-[48px_minmax(0,1fr)_120px_120px_64px_44px] items-center',
			'min-h-12 text-left focus-ring-inset',
			isActive ? 'bg-hover' : 'hover:bg-hover press:bg-surface-2',
			isPicked && swap && 'bg-accent-soft hover:bg-accent-soft'
		]}
		{@attach press()}
	>
		<span class="flex justify-center">
			<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-8" />
		</span>

		<span class="flex min-w-0 items-center gap-2 pr-2">
			<span class="truncate text-base font-extrabold tracking-tight text-ink">
				{@render name(exercise, match)}
			</span>

			{#if exercise.variantOf !== undefined && (searching || chipped)}
				{@render variantBadge()}
			{/if}
		</span>

		<span class="truncate pr-2 text-sm font-semibold text-ink-muted">{exercise.equipment}</span>

		{#if last === undefined}
			<span class="text-md font-bold text-ink-faint">—</span>
		{:else}
			<span class="text-md font-bold tracking-numeral text-ink">{last}</span>
		{/if}

		<span
			class={['text-md font-extrabold', since === undefined ? 'text-ink-faint' : 'text-ink-muted']}
		>
			{since ?? '—'}
		</span>

		{@render mark(isPicked)}
	</button>
{/snippet}

{#snippet trayRow(exercise: Exercise)}
	{@const session = lastPerformed[exercise.id]}
	{@const since = lastSinceLabel(session, now)}
	{@const isPicked = picked.has(exercise.id)}
	{@const match = searching ? matchRange(exercise.name, query) : null}

	<button
		type="button"
		aria-pressed={isPicked}
		onclick={() => choose(exercise)}
		data-ripple
		class={[
			'flex min-h-row w-full items-center gap-3 px-3 py-2 text-left focus-ring-inset',
			'press:bg-surface-2',
			isPicked && swap && 'bg-accent-soft'
		]}
		{@attach press()}
	>
		<span class="size-11 shrink-0">
			<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-full" />
		</span>

		<span class="flex min-w-0 flex-1 flex-col">
			<span class="flex min-w-0 items-center gap-2">
				<span class="truncate text-base font-extrabold tracking-tight text-ink">
					{@render name(exercise, match)}
				</span>

				{#if exercise.variantOf !== undefined && (searching || chipped)}
					{@render variantBadge()}
				{/if}
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
{/snippet}

{#snippet pickChips(wide: boolean)}
	{#each picks as id (id)}
		{@const pick = catalogById[id]}

		{#if pick !== undefined}
			<button
				type="button"
				aria-label="Remove {pick.name}"
				onclick={() => (picks = picks.filter((kept) => kept !== id))}
				class={[
					'flex shrink-0 items-center rounded-[10px] bg-sunken text-sm font-bold text-ink-muted',
					'focus-ring',
					wide ? 'h-9 gap-2 px-2.5' : 'h-10 gap-1.5 px-2'
				]}
				{@attach press()}
			>
				<span class={wide ? 'size-5.5' : 'size-6'}>
					<ExerciseIllustration id={pick.id} name={pick.name} class="size-full" />
				</span>
				<span class={['truncate', wide ? 'max-w-36' : 'max-w-22']}>{pick.name}</span>
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
