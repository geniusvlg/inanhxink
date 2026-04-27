# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL
ARG VITE_CDN_URL
ARG VITE_S3_ENDPOINT
ARG VITE_S3_BUCKET

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CDN_URL=$VITE_CDN_URL
ENV VITE_S3_ENDPOINT=$VITE_S3_ENDPOINT
ENV VITE_S3_BUCKET=$VITE_S3_BUCKET

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# Runtime stage: copy dist to volume on startup
FROM alpine:3.19

COPY --from=builder /app/dist /app/dist

CMD ["sh", "-c", "cp -r /app/dist/. /dist && echo 'Admin files copied'"]
