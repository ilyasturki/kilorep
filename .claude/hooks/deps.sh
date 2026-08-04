#!/usr/bin/env bash
# SessionStart — install dependencies when this checkout has none.
#
# A git worktree is a fresh checkout and node_modules is gitignored, so every
# executable the other hooks reach for starts out missing. `bun install`
# hardlinks from bun's global cache, so this is ~1.5s and costs no real disk:
# the files share inodes with the main checkout's.
#
# Copying node_modules in via .worktreeinclude is the obvious-looking fix and
# it does not work — see the comment there before reaching for it again.
#
# Formatting stays in format.sh. This hook only makes the tools exist.

set -uo pipefail

input=$(cat)
cwd=$(jq -r '.cwd // empty' <<<"$input")
[[ -n $cwd && -d $cwd ]] || exit 0

# Resolve the package root by walking up from the session's cwd, not from
# $CLAUDE_PROJECT_DIR — in a worktree that variable points at the main
# checkout, which is the one tree guaranteed to be installed already.
root=$(cd "$cwd" && while [[ $PWD != / ]]; do
	[[ -f package.json ]] && {
		echo "$PWD"
		break
	}
	cd ..
done)
[[ -n $root ]] || exit 0

# `.bin` is the tell, not node_modules itself: a .worktreeinclude-era copy has
# every package present and still cannot run a single one of them.
[[ -x "$root/node_modules/.bin/prettier" ]] && exit 0

cd "$root" || exit 0

# Nothing here is written to stdout bare. SessionStart is one of the three
# events where stdout becomes model context, and a wall of install log is not
# context — JSON keeps it a user-facing message instead.
if out=$(bun install --frozen-lockfile 2>&1); then
	jq -nc '{systemMessage: "Fresh checkout — installed dependencies."}'
else
	jq -nc --arg e "$out" \
		'{systemMessage: ("bun install failed — run it yourself; formatting is off until you do.\n" + $e)}'
fi

exit 0
