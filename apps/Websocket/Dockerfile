# Build context must be the repo root: docker build -f apps/Websocket/Dockerfile .
FROM oven/bun:1.3
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN bun install

WORKDIR /app/apps/Websocket
CMD ["bun", "src/index.ts"]
