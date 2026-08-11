#!/bin/sh
set -e

# TikTok/YouTube regularly change in ways that break older yt-dlp releases
# (e.g. TikTok's JS anti-bot challenge). Docker layer caching means the
# "latest" binary fetched at image build time can go stale for a long time
# across rebuilds, so self-update it on every container start instead.
# Best-effort: never block startup if GitHub/network is unreachable.
if command -v yt-dlp >/dev/null 2>&1; then
  timeout 20 yt-dlp -U 2>&1 || echo "yt-dlp self-update skipped (offline or already latest)"
fi

exec "$@"
