<script lang="ts">
	import { restRemaining } from '$lib/domain/workout';
	import Button from '$lib/ui/Button.svelte';

	/**
	 * The rest countdown. Quiet, never a modal, never blocking the next log.
	 *
	 * On-screen only, permanently, by decision — nothing fires when rest ends if
	 * you are not looking. Kilorep is the only app in its own threat matrix
	 * without an off-screen rest signal, and that is accepted rather than
	 * overlooked.
	 *
	 * The clock ticks here and the remaining time is computed from the stored
	 * `startedAt` on every tick, so this is a display that samples rather than a
	 * counter that accumulates. A tab throttled in the background, a phone that
	 * slept, a component that remounted — all of them resume exact, because none
	 * of them can make the subtraction wrong.
	 */
	type Props = {
		startedAt: number;
		seconds: number;
		onskip: () => void;
	};

	let { startedAt, seconds, onskip }: Props = $props();

	let now = $state(Date.now());

	const deadline = $derived(startedAt + seconds * 1000);

	// One timeout per second rather than a 4 Hz interval, and none at all once
	// the countdown is spent. The chip is never unmounted — `restStartedAt` only
	// goes null on skip, and a commit replaces one number with another — so an
	// interval here would keep waking the phone for the rest of the session,
	// through every set the user is actually performing.
	//
	// Rescheduling from an effect that reads `now` is what makes it re-arm: the
	// write below re-runs this, and a fresh commit (a new `deadline`) restarts
	// the chain. Aligned to the second boundary, so the digit turns over on time
	// rather than up to a tick late.
	$effect(() => {
		if (now >= deadline) {
			return;
		}

		const id = setTimeout(() => (now = Date.now()), (deadline - now) % 1000 || 1000);
		return () => clearTimeout(id);
	});

	const left = $derived(restRemaining(startedAt, seconds, now));
	const clock = $derived(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);

	// The last fifteen seconds are the ones worth glancing up for, and zero stays
	// on screen until it is dismissed or the next commit replaces it.
	const urgent = $derived(left <= 15);
</script>

<div
	class="flex min-h-chip items-center justify-between gap-3 rounded-xl border border-line
		bg-surface px-3"
	role="status"
	aria-label="Rest timer"
>
	<div class="flex items-baseline gap-2">
		<span class="label-caps">Rest</span>
		<span
			class={['text-xl font-extrabold tracking-numeral', urgent ? 'text-accent-text' : 'text-ink']}
		>
			{clock}
		</span>
	</div>

	<Button variant="chrome" caps onclick={onskip}>SKIP</Button>
</div>
