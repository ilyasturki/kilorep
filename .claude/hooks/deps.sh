#!/usr/bin/env bash

set -uo pipefail

pkg_root() {
	local root
	[[ -n ${1-} && -d $1 ]] || return 0
	root=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || return 0
	[[ -f "$root/package.json" ]] && echo "$root"
	return 0
}

ensure_deps() {
	local root=$1 lock fd rc=0 out
	[[ -x "$root/node_modules/.bin/prettier" ]] && return 0

	lock="${TMPDIR:-/tmp}/claude-kilorep-deps$(tr / - <<<"$root").lock"
	exec {fd}>"$lock" || return 1
	flock "$fd"

	if [[ ! -x "$root/node_modules/.bin/prettier" ]]; then
		out=$(cd "$root" && bun install --frozen-lockfile 2>&1) || rc=1
	fi

	exec {fd}>&-
	((rc == 0)) || printf '%s\n' "$out" >&2
	return $rc
}

if [[ ${1-} == --ensure ]]; then
	root=$(pkg_root "${2-}")
	[[ -n $root ]] || exit 0
	ensure_deps "$root"
	exit $?
fi

input=$(cat)
root=$(pkg_root "$(jq -r '.cwd // empty' <<<"$input")")
[[ -n $root ]] || exit 0
[[ -x "$root/node_modules/.bin/prettier" ]] && exit 0

# SessionStart stdout becomes model context, so the outcome goes out as JSON, not a log.
if err=$(ensure_deps "$root" 2>&1); then
	jq -nc '{systemMessage: "Fresh checkout — installed dependencies."}'
else
	jq -nc --arg e "$err" \
		'{systemMessage: ("bun install failed — run it yourself; formatting is off until you do.\n" + $e)}'
fi

exit 0
