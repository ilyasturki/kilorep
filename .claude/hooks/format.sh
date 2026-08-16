#!/usr/bin/env bash

set -uo pipefail

deps=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deps.sh

input=$(cat)
file=$(jq -r '.tool_input.file_path // empty' <<<"$input")
session=$(jq -r '.session_id // "nosession"' <<<"$input")
[[ -n $file && -f $file ]] || exit 0

case $file in
	*.ts | *.js | *.mjs | *.cjs | *.svelte | *.css | *.json | *.html) ;;
	*) exit 0 ;;
esac

root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null)
[[ -n $root && -f "$root/package.json" ]] || exit 0

prettier="$root/node_modules/.bin/prettier"
if [[ ! -x $prettier ]]; then
	if [[ -x $deps ]]; then
		err=$("$deps" --ensure "$root" 2>&1)
	else
		err="$deps is missing"
	fi

	if [[ ! -x $prettier ]]; then
		jq -nc --arg e "$err" \
			'{systemMessage: ("format hook: bun install failed — run it yourself. Files are not being formatted.\n" + $e)}'
		exit 0
	fi
fi

cd "$root" || exit 0
"$prettier" --write --log-level warn "${file#"$root"/}" >/dev/null 2>&1

: >"${TMPDIR:-/tmp}/claude-kilorep-dirty-$session"

exit 0
