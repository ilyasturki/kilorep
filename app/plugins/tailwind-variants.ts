import { defaultConfig, tv } from 'tailwind-variants'

// tailwind-merge can't classify our custom @theme font-size tokens and treats
// text-micro/label/body-sm/body/body-lg as text colors, so tv()/cn() drop
// whichever of the size or the real color (text-ink-3, text-on-accent, …)
// comes first in a class list. Registering them as font-size utilities keeps
// both. Flat shape (no `extend`): tailwind-variants nests it itself.
export default defineNuxtPlugin(() => {
    defaultConfig.twMergeConfig = {
        classGroups: {
            'font-size': [
                { text: ['micro', 'label', 'body-sm', 'body', 'body-lg'] },
            ],
        },
    }
    // A bare cn() never reads defaultConfig — only a tv() call copies the config
    // into tailwind-variants' internal merge cache. Force that sync here so it's
    // live before the first component renders. Without it, the cache only warms
    // if some page's tv() happens to run after this plugin, which holds during
    // SSR but not on the client, leaving cn() to drop the color token on
    // hydration (a check-only class mismatch).
    tv({})
})
