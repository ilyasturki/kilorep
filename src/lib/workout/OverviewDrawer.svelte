<script lang="ts">
	import { Drawer } from 'vaul-svelte';

	import type { Entry } from '$lib/workout/groups';
	import SessionList from '$lib/workout/SessionList.svelte';
	import { registerOverlay } from '$lib/ui/overlays';

	/**
	 * The session list, on a screen with no room to keep it open — docked to the
	 * left edge, where the rail holds the same list from `lg` up. One control in
	 * two postures, and this is the narrow one: the button opening it lives in
	 * the phone's own header, and a swipe rightward across the pane is the same
	 * ask made with the thumb (see the live page).
	 *
	 * A drawer and not a dialog at every width below `lg`, unlike `Sheet`'s
	 * split at `sm`: the left edge is this panel's identity — it mirrors where
	 * the rail lives — and a centred box on a tablet would put the session list
	 * in the one place it never otherwise appears. vaul with `direction="left"`
	 * keeps the finger-drag and the flick-to-dismiss the bottom sheets teach,
	 * rotated a quarter turn; skin and motion live in `overlay-drawer-left` and
	 * the `data-vaul-*` rules in app.css. No `Drawer.Handle`: the pill is a
	 * bottom-sheet glyph, and here the scrim, the flick and the hardware back
	 * already say everything it would.
	 */
	type Props = {
		open?: boolean;
		entries: Entry[];
		activeSetId: string | null;
		onjump: (setId: string) => void;
		oninsert: () => void;
		onreorder: (entryId: string, index: number) => void;
		ondrop?: (entryId: string) => void;
	};

	let {
		open = $bindable(false),
		entries,
		activeSetId,
		onjump,
		oninsert,
		onreorder,
		ondrop
	}: Props = $props();

	// While open, the hardware back button owns the first press — see
	// `ui/overlays.ts`. Registered from the effect so the cleanup runs on close
	// and on unmount alike.
	$effect(() => {
		if (!open) {
			return;
		}
		return registerOverlay(() => (open = false));
	});

	// Jumping is the whole reason the drawer was opened, so it closes behind the
	// tap. The rail, having nothing to close, passes `onjump` straight through —
	// which is why closing lives here and not in `SessionList`. Insert closes
	// for one more reason: the insert sheet is about to open, and a sheet over a
	// drawer is a fight over one focus trap.
	//
	// Reordering does not close it, and the asymmetry is the point: a jump is
	// finished when it lands, and reordering a session is a handful of drags you
	// want to see the result of before leaving. A lift selects the exercise all
	// the same — that is `onfocus`, handed straight down, closing nothing.
	function jump(setId: string) {
		onjump(setId);
		open = false;
	}

	function insert() {
		open = false;
		oninsert();
	}
</script>

<Drawer.Root bind:open direction="left">
	<Drawer.Portal>
		<Drawer.Overlay class="overlay-scrim-drawer" />

		<Drawer.Content class="overlay-panel overlay-drawer-left">
			<div class="px-4 pt-4 pb-0.5">
				<Drawer.Title class="title-panel">Session</Drawer.Title>
			</div>

			<!-- Same scroll-box recipe as `Sheet`'s body, same 6px argument: the
			     padding is what buys the first row's focus ring room to exist. -->
			<div class="min-h-0 flex-1 overflow-y-auto px-4 pt-1.5 pb-4">
				<SessionList
					{entries}
					{activeSetId}
					{onreorder}
					{ondrop}
					onjump={jump}
					onfocus={onjump}
					oninsert={insert}
				/>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
