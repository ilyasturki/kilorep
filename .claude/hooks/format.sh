#!/usr/bin/env bash
# PostToolUse(Edit|Write) — format the file that was just written.
#
# Formatting only. Linting is not run from a hook: `bun run lint` is the
# project's own gate and stays a deliberate command.

set -uo pipefail

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
	# Do not wedge the session over missing deps — say it once, loudly, and move on.
	jq -nc '{systemMessage: "format hook: node_modules missing — run `bun install`. Files are not being formatted."}'
	exit 0
fi

cd "$root" || exit 0
"$prettier" --write --log-level warn "${file#"$root"/}" >/dev/null 2>&1

# Mark the turn dirty so the Stop gate knows a source file changed. Skipping
# the project-wide check on pure question-and-answer turns keeps it free.
: >"${TMPDIR:-/tmp}/claude-kilorep-dirty-$session"

exit 0
