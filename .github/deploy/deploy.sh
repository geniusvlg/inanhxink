#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/inanhxink"

cd "$APP_DIR"

# Pull latest code (for nginx.conf, docker-compose.yml, deploy script)
git pull origin main

# Pull pre-built images from GHCR
docker compose pull frontend backend

# Recreate containers with new images
docker compose up -d

# Always restart nginx to pick up any nginx.conf changes
docker compose restart nginx

# Clean up old images
docker image prune -f

# Verify
docker compose ps
