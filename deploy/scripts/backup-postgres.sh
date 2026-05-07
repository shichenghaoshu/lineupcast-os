#!/usr/bin/env bash
#
# Backup LineupCast PostgreSQL database.
# Usage: ./deploy/scripts/backup-postgres.sh [container_name]
#
# Creates a gzip-compressed pg_dump in ./backups/ and removes backups
# older than the 7 most recent.

set -euo pipefail

CONTAINER="${1:-lineupcast-postgres-1}"
BACKUP_DIR="$(cd "$(dirname "$0")/../.." && pwd)/backups"
DB_NAME="${POSTGRES_DB:-lineupcast}"
DB_USER="${POSTGRES_USER:-lineupcast}"
KEEP=7

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

echo "Backing up database '${DB_NAME}' from container '${CONTAINER}'..."

docker exec "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges \
  | gzip > "$FILEPATH"

SIZE="$(du -h "$FILEPATH" | cut -f1)"
echo "Backup saved: ${FILEPATH} (${SIZE})"

# Prune old backups, keep the $KEEP most recent
BACKUP_COUNT="$(ls -1t "${BACKUP_DIR}/${DB_NAME}_"*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
if [ "$BACKUP_COUNT" -gt "$KEEP" ]; then
  REMOVED=0
  ls -1t "${BACKUP_DIR}/${DB_NAME}_"*.sql.gz | tail -n +"$((KEEP + 1))" | while read -r OLD; do
    rm -f "$OLD"
    REMOVED=$((REMOVED + 1))
    echo "Removed old backup: $(basename "$OLD")"
  done
fi

echo "Done. Total backups: $(ls -1 "${BACKUP_DIR}/${DB_NAME}_"*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
