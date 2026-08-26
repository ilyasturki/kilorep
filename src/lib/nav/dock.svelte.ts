/**
 * Whether a page has docked a working tray of its own over the bottom edge.
 *
 * The live screen keeps that edge by address — the tab bar checks its pathname — but the
 * record editor is a mode of `/history/[id]`, not an address, so the page raises this flag
 * instead. The claim must be made in an `$effect` whose cleanup lowers it: a back gesture or
 * a link out of the editor never says DONE, and a lowered bar left standing would follow the
 * lifter around the app.
 */
export const bottomDock = $state({ claimed: false });
