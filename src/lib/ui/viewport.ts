import { MediaQuery } from 'svelte/reactivity';

export const wideViewport = new MediaQuery('min-width: 40rem', false);

/** The lg rung, where the tab bar hands over to the app bar's nav — and the live
 *  session's phone column hands over to the desktop ledger. */
export const deskViewport = new MediaQuery('min-width: 64rem', false);
