#!/bin/sh
# Restore test (T166): restores the newest dump into a throw-away database, compares row counts of key
# tables with the live database, then drops it. Exit code != 0 when the backup cannot be restored.
#   docker compose run --rm backup /backup/restore-test.sh
set -eu
: "${PGHOST:=postgres}" "${PGUSER:=makvid}" "${PGDATABASE:=makvid}"
export PGHOST PGUSER
latest=$(ls -1t /backups/makvid-*.dump 2>/dev/null | head -1)
[ -n "$latest" ] || { echo "no backup found in /backups"; exit 1; }
check="makvid_restore_check"
psql -d postgres -qc "DROP DATABASE IF EXISTS $check"
psql -d postgres -qc "CREATE DATABASE $check"
pg_restore --no-owner --exit-on-error --dbname="$check" "$latest"
status=0
for t in users workspaces projects project_versions render_outputs usage_records batches plans _migrations; do
  live=$(psql -d "$PGDATABASE" -tAc "SELECT count(*) FROM $t" 2>/dev/null || echo "-")
  restored=$(psql -d "$check" -tAc "SELECT count(*) FROM $t" 2>/dev/null || echo "missing")
  echo "$t: live=$live restored=$restored"
  [ "$restored" = "missing" ] && status=1
done
psql -d postgres -qc "DROP DATABASE $check"
[ $status -eq 0 ] && echo "restore test ok: $(basename "$latest")" || echo "restore test FAILED"
exit $status
