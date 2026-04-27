FROM golang:1.26 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    libwebp-dev \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src/backend-golang

COPY backend-golang/go.mod backend-golang/go.sum ./
RUN go mod download

COPY backend-golang/ ./
RUN CGO_ENABLED=1 go build -o /server ./cmd/server

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    libwebp7 \
    python3 \
    python3-pip \
  && pip3 install --no-cache-dir --break-system-packages curl_cffi yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /

COPY --from=builder /server /server
COPY backend-golang/public/ /public/
COPY backend/public/templates/ /public/templates/

EXPOSE 3001

ENTRYPOINT ["/server"]
