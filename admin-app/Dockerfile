# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# Runtime stage: copy dist to volume on startup
FROM alpine:3.19

COPY --from=builder /app/dist /app/dist

CMD ["sh", "-c", "cp -r /app/dist/. /dist && echo 'Admin files copied'"]
