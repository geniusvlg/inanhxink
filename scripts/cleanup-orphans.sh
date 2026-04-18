#!/bin/bash
# Delete S3 uploads for orders that remained unpaid for more than 1 day.
# Run via cron: 0 3 * * * /var/www/inanhxink/scripts/cleanup-orphans.sh >> /var/log/inanhxink-cleanup.log 2>&1

set -euo pipefail

PROJECT_DIR="/var/www/inanhxink"
ENV_FILE="$PROJECT_DIR/.env"

get_env() {
  grep "^$1=" "$ENV_FILE" | cut -d'=' -f2-
}

DB_USER="inanhxink"
DB_NAME="inanhxink"

S3_ENDPOINT=$(get_env S3_ENDPOINT)
S3_REGION=$(get_env S3_REGION)
S3_BUCKET=$(get_env S3_BUCKET)

AWS_ACCESS_KEY_ID=$(get_env S3_ACCESS_KEY)
AWS_SECRET_ACCESS_KEY=$(get_env S3_SECRET_KEY)

awscli() {
  docker run --rm \
    -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    -v /tmp:/tmp \
    amazon/aws-cli "$@"
}

echo "[$(date -Iseconds)] ▶ Starting orphan cleanup"

# Fetch qr_names of orders that are still unpaid after 1 day
STALE_QR_NAMES=$(
  cd "$PROJECT_DIR"
  docker compose exec -T postgres \
    psql -U "$DB_USER" "$DB_NAME" -t -A \
    -c "SELECT qr_name FROM orders
        WHERE payment_status <> 'paid'
          AND created_at < NOW() - INTERVAL '1 day';"
)

DELETED_FOLDERS=0
SKIPPED=0

if [ -z "$STALE_QR_NAMES" ]; then
  echo "[$(date -Iseconds)] ✔ No stale orders found for full-folder cleanup."
else
for QR_NAME in $STALE_QR_NAMES; do
  PREFIX="uploads/$QR_NAME"

  # Check if the folder has any objects
  OBJECT_COUNT=$(
    awscli s3 ls "s3://$S3_BUCKET/$PREFIX/" \
      --endpoint-url "$S3_ENDPOINT" \
      --region "$S3_REGION" \
    | wc -l
  )

  if [ "$OBJECT_COUNT" -eq 0 ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Delete all objects under uploads/<qrName>/
  awscli s3 rm "s3://$S3_BUCKET/$PREFIX/" \
    --recursive \
    --endpoint-url "$S3_ENDPOINT" \
    --region "$S3_REGION"

  echo "[$(date -Iseconds)] 🗑  Deleted s3://$S3_BUCKET/$PREFIX/ ($OBJECT_COUNT objects)"
  DELETED_FOLDERS=$((DELETED_FOLDERS + 1))
done
fi

echo "[$(date -Iseconds)] ✔ Cleanup complete. Folders deleted: $DELETED_FOLDERS, skipped (empty): $SKIPPED"


# Also remove orphan audio files that were pre-downloaded at "Kiểm tra" step
# but never reached paid status (either no order created, or unpaid > 1 day).
UPLOAD_PREFIXES=$(awscli s3api list-objects-v2 \
  --bucket "$S3_BUCKET" \
  --prefix "uploads/" \
  --delimiter "/" \
  --endpoint-url "$S3_ENDPOINT" \
  --region "$S3_REGION" \
  --query 'CommonPrefixes[].Prefix' \
  --output text || true)

AUDIO_CLEANED=0
AUDIO_SKIPPED=0

for PREFIX_WITH_SLASH in $UPLOAD_PREFIXES; do
  QR_NAME=${PREFIX_WITH_SLASH#uploads/}
  QR_NAME=${QR_NAME%/}
  [ -z "$QR_NAME" ] && continue

  HAS_PAID=$(
    cd "$PROJECT_DIR"
    docker compose exec -T postgres \
      psql -U "$DB_USER" "$DB_NAME" -t -A -v qr_name="$QR_NAME" \
      -c "SELECT 1 FROM orders WHERE qr_name = :'qr_name' AND payment_status = 'paid' LIMIT 1;"
  )

  if [ -n "$HAS_PAID" ]; then
    AUDIO_SKIPPED=$((AUDIO_SKIPPED + 1))
    continue
  fi

  HAS_ANY_ORDER=$(
    cd "$PROJECT_DIR"
    docker compose exec -T postgres \
      psql -U "$DB_USER" "$DB_NAME" -t -A -v qr_name="$QR_NAME" \
      -c "SELECT 1 FROM orders WHERE qr_name = :'qr_name' LIMIT 1;"
  )

  HAS_STALE_UNPAID=$(
    cd "$PROJECT_DIR"
    docker compose exec -T postgres \
      psql -U "$DB_USER" "$DB_NAME" -t -A -v qr_name="$QR_NAME" \
      -c "SELECT 1 FROM orders
          WHERE qr_name = :'qr_name'
            AND payment_status <> 'paid'
            AND created_at < NOW() - INTERVAL '1 day'
          LIMIT 1;"
  )

  if [ -z "$HAS_ANY_ORDER" ] || [ -n "$HAS_STALE_UNPAID" ]; then
    awscli s3 rm "s3://$S3_BUCKET/uploads/$QR_NAME/" \
      --recursive \
      --exclude "*" \
      --include "*.mp3" \
      --include "*.m4a" \
      --include "*.wav" \
      --include "*.ogg" \
      --include "*.opus" \
      --include "*.webm" \
      --endpoint-url "$S3_ENDPOINT" \
      --region "$S3_REGION"

    echo "[$(date -Iseconds)] 🎵 Removed unpaid/orphan audio in uploads/$QR_NAME/"
    AUDIO_CLEANED=$((AUDIO_CLEANED + 1))
  else
    AUDIO_SKIPPED=$((AUDIO_SKIPPED + 1))
  fi
done

echo "[$(date -Iseconds)] ✔ Audio cleanup complete. Prefixes cleaned: $AUDIO_CLEANED, skipped: $AUDIO_SKIPPED"


# Remove orphan draft products (reserved but never finalised) older than 1 day,
# along with their S3 image folders under products/<type>/product-<id>/
STALE_DRAFTS=$(
  cd "$PROJECT_DIR"
  docker compose exec -T postgres \
    psql -U "$DB_USER" "$DB_NAME" -t -A \
    -c "SELECT id, type FROM products
        WHERE is_draft = true
          AND created_at < NOW() - INTERVAL '1 day';"
)

DRAFT_DELETED=0

if [ -z "$STALE_DRAFTS" ]; then
  echo "[$(date -Iseconds)] ✔ No orphaned draft products found."
else
  while IFS='|' read -r PRODUCT_ID PRODUCT_TYPE; do
    [ -z "$PRODUCT_ID" ] && continue

    PREFIX="products/$PRODUCT_TYPE/product-$PRODUCT_ID"

    # Delete S3 folder (ignore errors if folder doesn't exist)
    awscli s3 rm "s3://$S3_BUCKET/$PREFIX/" \
      --recursive \
      --endpoint-url "$S3_ENDPOINT" \
      --region "$S3_REGION" 2>/dev/null || true

    echo "[$(date -Iseconds)] 🗑  Deleted s3://$S3_BUCKET/$PREFIX/"

    # Delete DB row
    cd "$PROJECT_DIR"
    docker compose exec -T postgres \
      psql -U "$DB_USER" "$DB_NAME" -t -A \
      -c "DELETE FROM products WHERE id = $PRODUCT_ID;"

    echo "[$(date -Iseconds)] 🗑  Deleted draft product id=$PRODUCT_ID ($PRODUCT_TYPE)"
    DRAFT_DELETED=$((DRAFT_DELETED + 1))
  done <<< "$STALE_DRAFTS"
fi

echo "[$(date -Iseconds)] ✔ Draft product cleanup complete. Deleted: $DRAFT_DELETED"
