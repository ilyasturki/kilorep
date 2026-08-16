#!/usr/bin/env bash

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

root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)
[[ -n $root && -f "$root/package.json" ]] || exit 0

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
