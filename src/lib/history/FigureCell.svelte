<script lang="ts">
	import { tick } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	import { isEntryDraft, isWholeDraft, parseEntry, parseWhole } from '$lib/domain/workout';
	import type { Figure } from '$lib/history/editor.svelte';

	type Props = {
		kind: Figure;
		value: number | null;
		/** What the cell reads as while nobody is typing in it. */
		shown: string;
		label: string;
		editing: boolean;
		class?: ClassValue;
		onbegin: () => void;
		oncommit: (value: number | null) => void;
	};

	let { kind, value, shown, label, editing, class: klass, onbegin, oncommit }: Props = $props();

	// Non-null while the cell has focus: the raw number being typed, never the formatted one.
	let text = $state<string | null>(null);

	const draftable = (raw: string): boolean =>
		kind === 'reps' ? isWholeDraft(raw) : isEntryDraft(raw);

	const parsed = (raw: string): number | null =>
		kind === 'reps' ? parseWhole(raw) : parseEntry(raw);

	// Set by the press about to focus the cell: its mouseup would drop the caret where the finger
	// landed, and typing would then insert beside the number instead of replacing it.
	let pressed = false;

	function arm(event: PointerEvent & { currentTarget: HTMLInputElement }) {
		pressed = document.activeElement !== event.currentTarget;
	}

	async function begin(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;

		onbegin();
		text = value === null ? '' : String(value);

		await tick();
		input.select();
	}

	function land(event: MouseEvent & { currentTarget: HTMLInputElement }) {
		if (!pressed) {
			return;
		}

		pressed = false;
		event.preventDefault();
		event.currentTarget.select();
	}

	function type(event: Event & { currentTarget: HTMLInputElement }) {
		const raw = event.currentTarget.value;

		if (draftable(raw)) {
			text = raw;

			return;
		}

		event.currentTarget.value = text ?? '';
	}

	function settle() {
		pressed = false;

		if (text === null) {
			return;
		}

		const raw = text.trim();
		const next = raw === '' ? null : parsed(raw);

		text = null;

		// `-` or `.` alone is half a number: the cell goes back to what it held.
		if (raw !== '' && next === null) {
			return;
		}

		if (next !== value) {
			oncommit(next);
		}
	}

	function advance(input: HTMLInputElement) {
		const cells = [...document.querySelectorAll<HTMLInputElement>('input[data-figure]')];
		const after = cells[cells.indexOf(input) + 1];

		if (after === undefined) {
			input.blur();

			return;
		}

		after.focus();
	}

	function key(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key === 'Enter') {
			event.preventDefault();
			advance(event.currentTarget);
		} else if (event.key === 'Escape') {
			text = null;
			event.currentTarget.blur();
		}
	}
</script>

<input
	type="text"
	inputmode={kind === 'reps' ? 'numeric' : 'decimal'}
	enterkeyhint="next"
	autocomplete="off"
	spellcheck="false"
	data-figure
	aria-label={label}
	value={text ?? shown}
	onpointerdown={arm}
	onfocus={begin}
	onmouseup={land}
	oninput={type}
	onblur={settle}
	onkeydown={key}
	class={[
		'h-11 w-full min-w-0 rounded-lg px-2 text-right text-md tracking-numeral tabular-nums',
		'outline-none focus:bg-surface focus:ring-2 focus:ring-accent-text',
		'pointer-fine:transition-[background-color] pointer-fine:duration-100',
		editing ? 'bg-canvas' : 'bg-transparent',
		klass
	]}
/>
