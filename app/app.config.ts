export default defineAppConfig({
    // SVG mode renders an inline <svg> so icons inherit currentColor and the
    // existing `.select-* > svg` rules keep matching — matching Lucide's old DOM.
    icon: {
        mode: 'svg',
    },
})
