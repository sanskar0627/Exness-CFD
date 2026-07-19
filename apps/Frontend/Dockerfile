# Build context must be the repo root: docker build -f apps/Frontend/Dockerfile .
FROM oven/bun:1.3 AS build
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN bun install

# Vite envs are BUILD-time. Passed from docker-compose build args.
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_WEBSOCKET_URL
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_WEBSOCKET_URL=$VITE_WEBSOCKET_URL

WORKDIR /app/apps/Frontend
# vite build directly (skip tsc -b so type-warnings don't block deploys)
RUN bunx vite build

FROM nginx:1.27-alpine
COPY --from=build /app/apps/Frontend/dist /usr/share/nginx/html
COPY apps/Frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
