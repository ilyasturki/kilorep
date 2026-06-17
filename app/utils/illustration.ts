// Exercise illustrations live in public/illustrations/<slug>.svg, keyed by the
// slugified exercise name (see scripts/illustrations/GOAL.md). Custom exercises
// have no illustration, so callers must tolerate a missing file.
export function exerciseIllustrationSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}
