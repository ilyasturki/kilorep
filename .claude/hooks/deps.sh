#!/usr/bin/env bash
# SessionStart, CwdChanged — install dependencies when a checkout has none.
# Also `deps.sh --ensure DIR`, which is how the other hooks self-heal.
#
# A git worktree is a fresh checkout and node_modules is gitignored, so every
# executable the other hooks reach for starts out missing. `bun install`
# hardlinks from bun's global cache, so this is ~2s and costs no real disk:
# the files share inodes with the main checkout's.
#
# Copying node_modules in via .worktreeinclude is the obvious-looking fix and
# it does not work — see the comment there before reaching for it again.
#
# CwdChanged is here because SessionStart fires once, in the tree the session
# opened in — which is the one tree already guaranteed to be installed. A
# worktree entered mid-session never gets a SessionStart of its own, and used
# to land on format.sh's "node_modules missing" message on its first edit
# instead. CwdChanged also fires on every `cd` Claude runs, so the
# already-installed path stays a single -x test and nothing more.
#
# WorktreeCreate would be the tighter event and is the wrong one: it *replaces*
# worktree creation rather than observing it, so taking it means reimplementing
# the .worktreeinclude copy that puts .env and the seeded db in place.
#
# Formatting stays in format.sh. This hook only makes the tools exist.

set -uo pipefail

# The checkout DIR belongs to. Empty if it is under none, or under one with no
# package.json — a scratchpad or a /tmp working directory is not this project
# and must not be installed into.
#
# Always resolved from a real directory, never from $CLAUDE_PROJECT_DIR — in a
# worktree that variable points at the main checkout, which is the tree that is
# never the one missing anything. `--show-toplevel` gives the worktree its own
# root instead.
pkg_root() {
	local root
	[[ -n ${1-} && -d $1 ]] || return 0
	root=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || return 0
	[[ -f "$root/package.json" ]] && echo "$root"
	return 0
}

# Install into ROOT unless its executables are already there. Quiet on
# success; the install log goes to stderr on failure.
#
# `.bin` is the tell, not node_modules itself: a .worktreeinclude-era copy has
# every package present and still cannot run a single one of them.
ensure_deps() {
	local root=$1 lock fd rc=0 out
	[[ -x "$root/node_modules/.bin/prettier" ]] && return 0

	# Parallel Edits into a fresh worktree fire this from several hooks at
	# once. The lock makes the losers wait on the winner's install instead of
	# racing a second one into the same node_modules.
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

# Called by format.sh and gate.sh, which have already resolved their own root
# and only want the guarantee. No stdin, no JSON, exit status is the answer.
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

# Nothing here is written to stdout bare. SessionStart is one of the three
# events where stdout becomes model context, and a wall of install log is not
# context — JSON keeps it a user-facing message instead. CwdChanged discards
# output entirely, so on that event this is only ever a side effect.
if err=$(ensure_deps "$root" 2>&1); then
	jq -nc '{systemMessage: "Fresh checkout — installed dependencies."}'
else
	jq -nc --arg e "$err" \
		'{systemMessage: ("bun install failed — run it yourself; formatting is off until you do.\n" + $e)}'
fi

exit 0
