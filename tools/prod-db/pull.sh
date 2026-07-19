#!/usr/bin/env bash
# Pull a playable copy of the production database into .data/prod.db.
#
# Prod state is a single SQLite file, so this copy IS the whole app: every
# account, workout, weigh-in and API token hash. It is real user data — it lands
# in .data/ (gitignored) and must never leave this machine.
#
#   bun run db:pull-prod
#
# Goes in over ssh as root: the database belongs to the service's DynamicUser
# (StateDirectory=kilorep) and is unreadable to anyone else.
#
# Then run the app against the copy with `bun run dev:prod`. Migrations are not
# applied here — the server does that on boot (server/plugins/migrate.ts), so
# the copy is brought up to this checkout's schema the moment you start it.
set -euo pipefail

HOST="${KILOREP_PROD_HOST:-root@infra}"
REMOTE_DB="${KILOREP_PROD_DB:-/var/lib/kilorep/workout.db}"
LOCAL_DB="${KILOREP_PROD_COPY:-.data/prod.db}"
REMOTE_TMP="kilorep-prod-pull.db"

cd "$(dirname "${BASH_SOURCE[0]}")/../.."
mkdir -p "$(dirname "$LOCAL_DB")"

# `sqlite3 .backup` takes a crash-consistent copy while the service keeps
# writing (required in WAL mode); a raw scp of the file can tear it.
echo "--- dumping $REMOTE_DB on $HOST"
ssh "$HOST" "
    set -euo pipefail
    sqlite3 '$REMOTE_DB' \".backup '\$HOME/$REMOTE_TMP'\"
    chmod 600 \"\$HOME/$REMOTE_TMP\"
"

echo "--- fetching the dump"
scp -q "$HOST:$REMOTE_TMP" "$LOCAL_DB.incoming"
ssh "$HOST" "rm -f \"\$HOME/$REMOTE_TMP\""

if [ "$(sqlite3 "$LOCAL_DB.incoming" 'PRAGMA integrity_check;')" != "ok" ]; then
    echo "the fetched copy failed its integrity check; leaving $LOCAL_DB alone" >&2
    rm -f "$LOCAL_DB.incoming"
    exit 1
fi

# A leftover WAL from the previous copy belongs to a different database file;
# SQLite would replay it into this one and corrupt it.
rm -f "$LOCAL_DB" "$LOCAL_DB-wal" "$LOCAL_DB-shm"
mv -f "$LOCAL_DB.incoming" "$LOCAL_DB"
chmod 600 "$LOCAL_DB"

echo
echo "ready: $LOCAL_DB — run it with 'bun run dev:prod'"
