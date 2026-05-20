# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY services ./services
RUN npm install
RUN npm run build -w @citybrain/shared && \
    npm run build -w @citybrain/agent-tools && \
    npm run build -w @citybrain/api

FROM node:20-alpine AS api
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/api ./services/api
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "services/api/dist/index.js"]

FROM node:20-alpine AS web-builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web ./apps/web
RUN npm install
RUN npm run build -w @citybrain/web

FROM nginx:alpine AS web
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-builder /app/apps/web/dist /usr/share/nginx/html
COPY infra/web-fallback /usr/share/nginx/html/fallback
EXPOSE 80
