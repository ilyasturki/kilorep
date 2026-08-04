<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { cursorFor, cursors } from '$lib/domain/workout';
	import { activeWorkout } from '$lib/workout/active.svelte';

	/**
	 * The Dashboard's way into a workout: continue the one running, or start one.
	 *
	 * It is here because the Dashboard is home — `/` in the APK, `AFTER_LOGIN`
	 * and the top bar's mark all land on it — and home had no door into the one
	 * thing the app is for. A cold boot opened on four standing answers and left
	 * the way to the gym floor to a tab, which is a tap the screen that greets
	 * you should not make you find. PRODUCT.md fixes this screen to four
	 * questions and says anything not phrasable as one stays off it; this is the
	 * stated exception, on the grounds that it is not a fifth answer but the exit.
	 *
	 * One link and one address in both states. `/workout` already redirects to
	 * `/workout/live` the moment the holder is full and the live route redirects
	 * back when it empties — the pair of guards those two routes state at each
	 * other — so this has no branch to get wrong and no session to mint. That is
	 * also what keeps PRODUCT.md's "nothing starts a workout except an explicit
	 * start" true here: idle, this lands on the idle screen, where the templates
	 * and the empty start already are, and nothing has begun.
	 *
	 * The dot is the accent, the same one both nav bars badge a live tab with and
	 * for the same reason — a live session is the one navigation target entitled
	 * to the colour that means "this logs a set". The idle banner is neutral: it
	 * is a door, and the lime is not a decoration for the most important door on
	 * a screen.
	 *
	 * Read once, not watched: the session's own numbers move only on the screen
	 * that logs them, and this one is left the moment either changes.
	 */
	const session = $derived(activeWorkout.session);

	/**
	 * Where the session is: the exercise holding the cursor. Null once the
	 * cursor is — a finished session, or one with nothing in it yet — where the
	 * set count carries the line alone rather than naming an exercise the user is
	 * no longer on.
	 */
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

	/**
	 * Sets checked off so far — warmups included, unlike every volume figure on
	 * this screen. The word is *logged*: this counts taps on the check, which is
	 * the honest measure of how far in a session is, and CLAUDE.md's rule is
	 * about what volume counts rather than about what the user did.
	 */
	const logged = $derived(
		session === null ? 0 : cursors(session.workout).filter((cursor) => cursor.set.completed).length
	);

	const meta = $derived.by(() => {
		const parts: string[] = [];

		if (where !== null) {
			parts.push(where);
		}

		if (logged > 0) {
			parts.push(logged === 1 ? '1 set' : `${logged} sets`);
		}

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
