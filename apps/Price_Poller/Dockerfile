# Build context must be the repo root: docker build -f apps/Price_Poller/Dockerfile .
FROM oven/bun:1.3
WORKDIR /app

# openssl needed by Prisma engines (kafka consumer writes to Postgres)
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN bun install
RUN bunx prisma generate --schema packages/database/prisma/schema.prisma

WORKDIR /app/apps/Price_Poller
CMD ["bun", "src/index.ts"]
