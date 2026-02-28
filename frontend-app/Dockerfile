# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Runtime stage: copy dist to volume on startup
FROM alpine:3.19

COPY --from=builder /app/dist /app/dist

CMD ["sh", "-c", "cp -r /app/dist/. /dist && echo 'Frontend files copied'"]
