#!/usr/bin/env bash
#
# Restore LineupCast PostgreSQL database from a backup file.
# Usage: ./deploy/scripts/restore-postgres.sh <backup_file.sql.gz> [container_name]

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.sql.gz> [container_name]"
  echo ""
  echo "Available backups:"
  BACKUP_DIR="$(cd "$(dirname "$0")/../.." && pwd)/backups"
  ls -lh "${BACKUP_DIR}/"*.sql.gz 2>/dev/null || echo "  (none found in ${BACKUP_DIR})"
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER="${2:-lineupcast-postgres-1}"
DB_NAME="${POSTGRES_DB:-lineupcast}"
DB_USER="${POSTGRES_USER:-lineupcast}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will DROP and recreate the '${DB_NAME}' database."
echo "Backup file: $BACKUP_FILE"
echo "Container:   $CONTAINER"
echo ""
read -rp "Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "Dropping and recreating database..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo "Restoring from backup..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet

echo "Restore complete."
