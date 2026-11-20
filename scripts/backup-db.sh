#!/usr/bin/env bash
# Backs up the database of docker-compose.prod.yml to backups/ as a
# compressed SQL dump and deletes backups older than BACKUP_KEEP_DAYS
# (14 by default). Run it from anywhere:
#   bash scripts/backup-db.sh
# Every night at 03:30 with cron (crontab -e), from the project folder:
#   30 3 * * * cd /home/USER/regelvakt && bash scripts/backup-db.sh >> backups/backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
keep_days="${BACKUP_KEEP_DAYS:-14}"
mkdir -p backups
file="backups/regelvakt-$(date +%Y-%m-%d-%H%M).sql.gz"
# Removed when the dump fails, so no half-written file is left behind
trap 'rm -f "$file.partial"' EXIT

# The database's own user and name, as the db container was started with
# them, so the script follows DB_USER and DB_NAME in .env.
# Written under another name first, so a failed dump never looks like a
# finished backup. --clean drops each table before it is created again,
# so the file restores over an existing database.
docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  | gzip > "$file.partial"
mv "$file.partial" "$file"

find backups -name 'regelvakt-*.sql.gz' -mtime +"$keep_days" -delete
echo "$(date -Iseconds) backup written: $file ($(du -h "$file" | cut -f1))"
