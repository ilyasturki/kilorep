#!/usr/bin/env bash
# Stop — project-wide `bun run format` before the turn ends.
#
# The per-file PostToolUse hook only sees files it was handed; this catches
# anything written by a shell command, and any drift after a prettier config
# change. It runs only when a source file actually changed this turn (the dirty
# marker), so conversational turns stay free.
#
# Linting is not run here. `bun run lint` stays a deliberate command.
#
# Blocking is capped at MAX_BLOCKS per turn. A blanket `stop_hook_active` guard
# would exit on the second pass and never re-verify the fix, which defeats the
# gate; a counter lets it verify and still converge.

set -uo pipefail

MAX_BLOCKS=3

deps=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deps.sh

input=$(cat)
cwd=$(jq -r '.cwd // empty' <<<"$input")
session=$(jq -r '.session_id // "nosession"' <<<"$input")
[[ -n $cwd && -d $cwd ]] || exit 0

state=${TMPDIR:-/tmp}
dirty="$state/claude-kilorep-dirty-$session"
blocks="$state/claude-kilorep-blocks-$session"

[[ -f $dirty ]] || exit 0

root=$(cd "$cwd" && while [[ $PWD != / ]]; do
	[[ -f package.json ]] && {
		echo "$PWD"
		break
	}
	cd ..
done)
[[ -n $root ]] || exit 0

# A turn that only wrote through shell commands never reached format.sh, so a
# fresh worktree can still be bare by the time the gate runs. Install, and skip
# the check rather than block the turn if that fails — the message for a broken
# install belongs to the hook that tried it, not here.
[[ -x $deps ]] && "$deps" --ensure "$root" >/dev/null 2>&1
[[ -x "$root/node_modules/.bin/prettier" ]] || exit 0

cd "$root" || exit 0

if fmt=$(bun run --silent format 2>&1); then
	rm -f "$dirty" "$blocks"
	exit 0
fi

count=$(($(cat "$blocks" 2>/dev/null || echo 0) + 1))
echo "$count" >"$blocks"

if ((count > MAX_BLOCKS)); then
	rm -f "$dirty" "$blocks"
	jq -nc --argjson n "$MAX_BLOCKS" \
		'{systemMessage: "Stop gate still failing after \($n) attempts — letting the turn end. Run `bun run format:write` yourself."}'
	exit 0
fi

printf 'Files are not formatted. Run `bun run format:write`.\n\n%s\n' "$fmt" >&2
exit 2
