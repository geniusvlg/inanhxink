#!/bin/bash
# Daily PostgreSQL backup → Viettel S3
# Retention: 7 days
# Run via cron: 0 2 * * * /var/www/inanhxink/scripts/backup-db.sh >> /var/log/inanhxink-backup.log 2>&1

set -euo pipefail

PROJECT_DIR="/var/www/inanhxink"
ENV_FILE="$PROJECT_DIR/.env"

# ---------------------------------------------------------------------------
# Parse a single key from .env without sourcing the file (handles special
# characters in values like passwords with $%^ safely)
# ---------------------------------------------------------------------------
get_env() {
  grep "^$1=" "$ENV_FILE" | cut -d'=' -f2-
}

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DB_USER="inanhxink"
DB_NAME="inanhxink"

S3_ENDPOINT=$(get_env S3_ENDPOINT)
S3_REGION=$(get_env S3_REGION)
S3_BUCKET=$(get_env S3_BUCKET)
S3_PREFIX="backups"
RETENTION_DAYS=7

AWS_ACCESS_KEY_ID=$(get_env S3_ACCESS_KEY)
AWS_SECRET_ACCESS_KEY=$(get_env S3_SECRET_KEY)

# Wrapper: runs AWS CLI via Docker (no awscli installation needed on host)
awscli() {
  docker run --rm \
    -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    -v /tmp:/tmp \
    amazon/aws-cli "$@"
}

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="/tmp/inanhxink-$TIMESTAMP.dump.gz"

# ---------------------------------------------------------------------------
echo "[$(date -Iseconds)] ▶ Starting backup ($TIMESTAMP)"

# Dump via the running postgres container (no pg_dump needed on host)
cd "$PROJECT_DIR"
docker compose exec -T postgres \
  pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] ✔ Dump created: $SIZE"

# ---------------------------------------------------------------------------
# Upload to S3
# ---------------------------------------------------------------------------
awscli s3 cp "/tmp/inanhxink-$TIMESTAMP.dump.gz" \
  "s3://$S3_BUCKET/$S3_PREFIX/$TIMESTAMP.dump.gz" \
  --endpoint-url "$S3_ENDPOINT" \
  --region "$S3_REGION" \
  --no-progress

echo "[$(date -Iseconds)] ✔ Uploaded → s3://$S3_BUCKET/$S3_PREFIX/$TIMESTAMP.dump.gz"

# Remove local temp file
rm -f "$BACKUP_FILE"

# ---------------------------------------------------------------------------
# Prune backups older than RETENTION_DAYS
# ---------------------------------------------------------------------------
CUTOFF=$(date -d "$RETENTION_DAYS days ago" --iso-8601=seconds)
echo "[$(date -Iseconds)] ▶ Pruning backups older than $RETENTION_DAYS days (cutoff: $CUTOFF)"

awscli s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" \
  --endpoint-url "$S3_ENDPOINT" \
  --region "$S3_REGION" \
| while read -r file_date file_time _size fname; do
    [[ -z "$fname" ]] && continue
    file_datetime="${file_date}T${file_time}"
    if [[ "$file_datetime" < "$CUTOFF" ]]; then
      awscli s3 rm "s3://$S3_BUCKET/$S3_PREFIX/$fname" \
        --endpoint-url "$S3_ENDPOINT" \
        --region "$S3_REGION"
      echo "[$(date -Iseconds)] 🗑  Deleted old backup: $fname"
    fi
  done

echo "[$(date -Iseconds)] ✔ Backup complete."
