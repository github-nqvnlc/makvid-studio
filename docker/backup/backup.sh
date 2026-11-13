#!/bin/sh
# Daily PostgreSQL backup (T166; FR-057). Runs in the "backup" service (postgres image, internal network):
# one compressed custom-format dump per run in /backups, dumps older than BACKUP_KEEP_DAYS are deleted.
#   once:  docker compose run --rm backup /backup/backup.sh
#   loop:  the service runs it every BACKUP_EVERY_SECONDS (default 86400)
set -eu
: "${PGHOST:=postgres}" "${PGUSER:=makvid}" "${PGDATABASE:=makvid}" "${BACKUP_KEEP_DAYS:=14}"
export PGHOST PGUSER PGDATABASE
mkdir -p /backups
stamp=$(date -u +%Y%m%d-%H%M%S)
tmp="/backups/.makvid-$stamp.dump.partial"
pg_dump --format=custom --compress=6 --no-owner --file="$tmp"
# Verify the archive is readable before it counts as a backup.
pg_restore --list "$tmp" > /dev/null
mv "$tmp" "/backups/makvid-$stamp.dump"
find /backups -name 'makvid-*.dump' -type f -mtime +"$BACKUP_KEEP_DAYS" -delete
echo "backup ok: makvid-$stamp.dump ($(du -h "/backups/makvid-$stamp.dump" | cut -f1)), kept $(ls /backups/makvid-*.dump | wc -l)"
