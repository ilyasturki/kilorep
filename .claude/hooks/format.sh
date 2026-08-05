#!/usr/bin/env bash
# PostToolUse(Edit|Write) — format the file that was just written.
#
# Formatting only. Linting is not run from a hook: `bun run lint` is the
# project's own gate and stays a deliberate command.

set -uo pipefail

# Resolved before anything cd's. deps.sh is a sibling in every case: the hook
# runs by the relative path in settings.json, from whichever tree that path
# resolved in.
deps=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deps.sh

input=$(cat)
file=$(jq -r '.tool_input.file_path // empty' <<<"$input")
session=$(jq -r '.session_id // "nosession"' <<<"$input")
[[ -n $file && -f $file ]] || exit 0

# Only what prettier handles here. *.md is excluded on purpose —
# .prettierignore treats prose as hand-authored.
case $file in
	*.ts | *.js | *.mjs | *.cjs | *.svelte | *.css | *.json | *.html) ;;
	*) exit 0 ;;
esac

# Resolve the package root by walking up from the file, not from
# $CLAUDE_PROJECT_DIR — in a git worktree that variable points at the main
# checkout and would run the wrong tree's config against the wrong sources.
root=$(cd "$(dirname "$file")" && while [[ $PWD != / ]]; do
	[[ -f package.json ]] && {
		echo "$PWD"
		break
	}
	cd ..
done)
[[ -n $root ]] || exit 0

prettier="$root/node_modules/.bin/prettier"
if [[ ! -x $prettier ]]; then
	# A worktree entered mid-session gets no SessionStart, so the first edit
	# into one lands here, on a bare checkout. Install it rather than complain
	# about it — ~2s, once per tree. deps.sh is idempotent and locked, so the
	# rest of a parallel batch waits rather than piling on.
	if [[ -x $deps ]]; then
		err=$("$deps" --ensure "$root" 2>&1)
	else
		err="$deps is missing"
	fi

	# Do not wedge the session over missing deps — say it once, loudly, and move on.
	if [[ ! -x $prettier ]]; then
		jq -nc --arg e "$err" \
			'{systemMessage: ("format hook: bun install failed — run it yourself. Files are not being formatted.\n" + $e)}'
		exit 0
	fi
fi

cd "$root" || exit 0
"$prettier" --write --log-level warn "${file#"$root"/}" >/dev/null 2>&1

# Mark the turn dirty so the Stop gate knows a source file changed. Skipping
# the project-wide check on pure question-and-answer turns keeps it free.
: >"${TMPDIR:-/tmp}/claude-kilorep-dirty-$session"

exit 0
