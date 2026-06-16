// Monotonic client-only id for keying draft lists. A FLIP reorder animation
// needs a key that stays with an item across a splice, which the array index
// can't give. Starts from 0 in each environment, so SSR and the client produce
// the same sequence and hydration keys line up.
let counter = 0
export function uid(): number {
    return ++counter
}
