FROM golang:1.26 AS builder

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    libwebp-dev \
    pkg-config

WORKDIR /src/backend-golang

COPY backend-golang/go.mod backend-golang/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY backend-golang/ ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 go build -o /server ./cmd/server

FROM debian:bookworm-slim

ARG TARGETARCH

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    libwebp7

RUN case "${TARGETARCH:-$(dpkg --print-architecture)}" in \
      amd64) YT_DLP_ASSET=yt-dlp_linux ;; \
      arm64) YT_DLP_ASSET=yt-dlp_linux_aarch64 ;; \
      *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
  && curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/${YT_DLP_ASSET}" \
      -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp

WORKDIR /

COPY --from=builder /server /server
COPY backend-golang/public/ /public/

EXPOSE 3001

ENTRYPOINT ["/server"]
