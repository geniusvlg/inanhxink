# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Export built files (used as a build artifact by nginx)
FROM alpine:3.19

WORKDIR /dist

COPY --from=builder /app/dist .
