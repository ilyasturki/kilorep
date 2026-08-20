#!/usr/bin/env bash
set -euo pipefail

# Pull one account out of production into a local database file.
#
# Production is the NixOS module in nix/module.nix: the database lives in a
# systemd StateDirectory at 0750 under a DynamicUser, with UMask 0077, so root
# is its only reader. `ssh infra` lands as ilyas, whose sudo asks for a
# password; root takes the same key, so this stays unattended.
#
# The account filter runs on the server, on the staged copy, before a byte is
# sent: kilorep.com has allowRegistration on, so the live database holds other
# people's addresses, Google identities and workouts, and none of that has any
# business on a laptop.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

host="${KILOREP_HOST:-root@infra}"
dest=.data/prod.db
default_email=turki.ilyass@gmail.com
# Matches scripts/seed.ts, and clears createUser's eight-character minimum.
dev_password=devdevdev

usage() {
	cat >&2 <<-USAGE
		usage: scripts/db-pull.sh [EMAIL]

		  EMAIL          the account to pull (default: $default_email)
		  KILOREP_HOST   where production answers (default: $host)

		Lands $dest and sets a known dev password on it. The live
		database is only ever read.
	USAGE
	exit 1
}

case "${1:-}" in
	-h | --help) usage ;;
esac

# Addresses are stored lowercased (normalizeEmail, in src/lib/server/auth/
# accounts.ts), and the remote comparison is SQLite's BINARY collation — so a
# mixed-case argument would find nothing and report a missing account.
email="${1:-$default_email}"
email="${email,,}"

# The address is interpolated into a remote shell command and into SQL, and
# this pattern is what keeps that safe: it admits no quote, backslash or space.
if [[ ! $email =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
	echo "error: '$email' is not an email address" >&2
	exit 1
fi

mkdir -p .data
staged="$(mktemp .data/.pull.XXXXXX)"
trap 'rm -f "$staged"' EXIT

echo "pulling $email from $host" >&2

# stdout carries the database bytes and nothing else, so the remote side keeps
# every word it says on stderr. One connection, so the staging directory is
# removed by its own trap even if this end is interrupted.
ssh -T "$host" "bash -s -- '$email'" > "$staged" <<'REMOTE'
set -euo pipefail

# `ssh host command` runs a non-login shell, and sqlite3 lives in the system
# profile (infra-apps system/packages.nix) rather than anywhere sshd's default
# PATH would look.
export PATH=/run/current-system/sw/bin:$PATH

email="$1"
# services.kilorep.databasePath, left at the module default.
db=/var/lib/kilorep/kilorep.db

[ -r "$db" ] || {
	echo "no readable database at $db — is this the right host, and is this root?" >&2
	exit 1
}

staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
copy="$staging/kilorep.db"

# `.backup` is the only correct copy of a live WAL database: a raw cp can tear
# it mid-write. This is the same call the hourly restic job makes on this file,
# and like it, the server keeps serving throughout.
sqlite3 "$db" ".backup '$copy'"

if [ "$(sqlite3 "$copy" "select count(*) from users where email = '$email';")" -eq 0 ]; then
	# Deliberately without the addresses that are there: not naming them is the
	# whole point of filtering here.
	echo "no account for $email in production" >&2
	exit 1
fi

# Foreign keys are off by default in the sqlite3 CLI, and every dependent table
# hangs off users by ON DELETE CASCADE — without the pragma the delete would
# leave every other account's records, tokens and counters orphaned in place.
# The VACUUM is not tidiness either: deleted rows sit in free pages, legible to
# anyone who opens the file, until it rewrites them away.
sqlite3 "$copy" <<SQL
pragma foreign_keys = on;
delete from users where email <> '$email';
delete from google_codes;
vacuum;
SQL

[ "$(sqlite3 "$copy" 'pragma integrity_check;')" = ok ] || {
	echo "the filtered copy failed its integrity check; nothing was sent" >&2
	exit 1
}

cat "$copy"
REMOTE

# A leftover WAL belongs to the database being replaced, and SQLite would
# replay it into the new file; `.backup` output arrives with no sidecars.
rm -f "$dest-wal" "$dest-shm"
mv -f "$staged" "$dest"

# Migrates the copy to this checkout's schema on the way past — which the first
# `bun run dev` would do regardless — and revokes the credentials it arrived
# with, which are dead here anyway.
printf '%s' "$dev_password" | DATABASE_PATH="$dest" bun run --silent account:password "$email"

cat <<SUMMARY

$dest is ready:

  DATABASE_PATH=$dest bun run dev

Sign in as $email with the password $dev_password.
SUMMARY
