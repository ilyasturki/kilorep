<script lang="ts">
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	type Props = {
		open?: boolean;
		// What is holding the training, in the word its build uses: a phone, a browser.
		place: string;
		// The account arriving, when whatever summoned this knew its address.
		email: string | null;
		onadopt: () => void;
		onwipe: () => void;
		oncancel: () => void;
	};

	let { open = $bindable(false), place, email, onadopt, onwipe, oncancel }: Props = $props();

	let wipeOpen = $state(false);

	// Neither is `$state`: they are notes about how the sheet closed, read only by the
	// effect below, and making them reactive would re-run it for its own writes.
	let live = false;
	let decided = false;

	function close(settle: () => void): void {
		decided = true;
		open = false;
		wipeOpen = false;

		settle();
	}

	// A dismissal — the scrim, Escape, the back gesture — is a cancellation, and the one
	// that matters: it is the exit that would otherwise leave the arriving account signed
	// in over somebody else's records, syncing nothing and saying nothing. Held here so
	// that neither of the two call sites can forget it.
	$effect(() => {
		if (open) {
			live = true;
			return;
		}

		if (!live) {
			return;
		}

		live = false;

		if (decided) {
			decided = false;
			return;
		}

		oncancel();
	});
</script>

<Sheet
	bind:open
	title="This {place} belongs to another account"
	description="Everything logged here was synced as somebody else. Choose what happens to it before {email ??
		'the new account'} takes over."
>
	<div class="flex flex-col gap-5 pt-2">
		<div class="flex flex-col gap-2">
			<Button variant="secondary" onclick={() => close(onadopt)}>Move it to this account</Button>
			<p class="px-1 text-sm text-pretty text-ink-muted">
				Every workout, template and weight on this {place} is copied across. The other account keeps its
				own.
			</p>
		</div>

		<div class="flex flex-col gap-2">
			<Button variant="destructive" onclick={() => (wipeOpen = true)}>Erase this {place}</Button>
			<p class="px-1 text-sm text-pretty text-ink-muted">
				Local data is deleted and replaced with whatever the new account has on the server.
			</p>
		</div>

		<Button variant="chrome" caps onclick={() => close(oncancel)}>CANCEL</Button>
	</div>
</Sheet>

<AlertDialog
	bind:open={wipeOpen}
	title="Erase everything on this {place}?"
	description="Every workout, template and body weight held here is deleted, including any that never reached a server. There is no undo."
	confirmLabel="Erase"
	onconfirm={() => close(onwipe)}
/>
