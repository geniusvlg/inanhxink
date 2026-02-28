#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/inanhxink"

cd "$APP_DIR"
git pull origin main
docker compose up -d --build
docker image prune -f
docker compose ps
