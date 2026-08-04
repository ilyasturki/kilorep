<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { cursorFor, cursors } from '$lib/domain/workout';
	import { activeWorkout } from '$lib/workout/active.svelte';

	const session = $derived(activeWorkout.session);

	const where = $derived.by(() => {
		if (session === null || session.activeSetId === null) {
			return null;
		}

		const cursor = cursorFor(session.workout, session.activeSetId);

		if (cursor === null) {
			return null;
		}

		return catalogById[cursor.exercise.exerciseId]?.name ?? cursor.exercise.exerciseId;
	});

	const logged = $derived(
		session === null ? 0 : cursors(session.workout).filter((cursor) => cursor.set.completed).length
	);

	const meta = $derived.by(() => {
		const sets = logged === 1 ? '1 set' : `${logged} sets`;
		const parts = [where, logged === 0 ? null : sets].filter((part) => part !== null);

		return parts.length === 0 ? null : parts.join(' · ');
	});
</script>

<a
	href="/workout"
	class="flex min-h-row items-center gap-3 rounded-2xl border border-line-soft bg-surface p-3
		focus-ring pointer-fine:transition-colors pointer-fine:hover:bg-hover"
>
	<span class="flex min-w-0 flex-1 flex-col gap-0.5 px-1">
		<span class="flex items-center gap-2 text-base font-extrabold tracking-tight text-ink">
			{#if session !== null}
				<span class="size-1.5 shrink-0 rounded-full bg-accent"></span>
				Workout in progress
			{:else}
				Start a workout
			{/if}
		</span>

		{#if meta !== null}
			<span class="truncate text-sm font-bold text-ink-faint">{meta}</span>
		{/if}
	</span>

	<span aria-hidden="true" class="shrink-0 text-xl leading-none text-ink-faint">›</span>
</a>
