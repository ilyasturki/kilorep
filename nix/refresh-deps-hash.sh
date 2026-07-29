#!/usr/bin/env bash
# Refresh the `deps` fixed-output hash in nix/package.nix.
#
# The `deps` derivation pins the node_modules closure with `outputHash`. Nix has
# no link between that hash and bun.lock, so changing dependencies silently makes
# it stale and the build fails. Run this after any bun.lock / package.json change:
#
#   bun run nix:deps-hash
#
# It sets a deliberately wrong hash, lets Nix report the real one, then writes it
# back. The wrong hash is what forces the work: a fixed-output derivation's store
# path comes from its hash and not from its inputs, so building the declared hash
# would hit the existing output and report success over stale dependencies.
#
# Safe to run anytime, and it prints "unchanged" when the hash is already right —
# but it is never cheap, because every run reinstalls the tree to hash it.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_nix="$script_dir/package.nix"
fake_hash="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

current="$(grep -oP 'outputHash = "\Ksha256-[^"]*' "$package_nix" || true)"
if [[ -z "$current" ]]; then
	echo "error: could not find an outputHash in $package_nix" >&2
	exit 1
fi

write_hash() {
	sed -i -E "s|outputHash = \"sha256-[^\"]*\";|outputHash = \"$1\";|" "$package_nix"
}

# Restore the original hash if anything below fails, so the file is never left
# with the fake hash committed by accident.
trap 'write_hash "$current"' EXIT

write_hash "$fake_hash"

echo "==> building .#kilorep.deps to compute the hash (this runs bun install)..."
build_output="$(nix build .#kilorep.deps --no-link 2>&1 || true)"

new_hash="$(printf '%s\n' "$build_output" | grep -oP 'got:\s+\Ksha256-\S*' || true)"
if [[ -z "$new_hash" ]]; then
	echo "$build_output" >&2
	echo "error: could not parse the new hash from the build output above" >&2
	exit 1
fi

trap - EXIT
write_hash "$new_hash"

if [[ "$new_hash" == "$current" ]]; then
	echo "==> deps outputHash already up to date: $new_hash"
else
	echo "==> deps outputHash updated"
	echo "    old: $current"
	echo "    new: $new_hash"
fi
