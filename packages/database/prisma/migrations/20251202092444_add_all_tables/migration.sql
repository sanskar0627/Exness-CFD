-- DropIndex
DROP INDEX "public"."Trade_timestamp_idx";

-- CreateTable
CREATE TABLE "users" (
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 500000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "provider" TEXT,
    "providerId" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "closed_orders" (
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "margin" INTEGER NOT NULL,
    "initialMargin" INTEGER NOT NULL,
    "addedMargin" INTEGER NOT NULL DEFAULT 0,
    "leverage" INTEGER NOT NULL,
    "openPrice" INTEGER NOT NULL,
    "closePrice" INTEGER NOT NULL,
    "liquidationPrice" INTEGER NOT NULL,
    "takeProfit" INTEGER,
    "stopLoss" INTEGER,
    "pnl" INTEGER NOT NULL,
    "closeReason" TEXT NOT NULL,
    "closeMessage" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trailingStopLossEnabled" BOOLEAN NOT NULL DEFAULT false,
    "trailingStopLossDistance" INTEGER,
    "trailingStopLossHighestPrice" INTEGER,
    "trailingStopLossLowestPrice" INTEGER,

    CONSTRAINT "closed_orders_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "user_snapshots" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_snapshots" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "margin" INTEGER NOT NULL,
    "initialMargin" INTEGER NOT NULL,
    "addedMargin" INTEGER NOT NULL DEFAULT 0,
    "leverage" INTEGER NOT NULL,
    "openPrice" INTEGER NOT NULL,
    "liquidationPrice" INTEGER NOT NULL,
    "takeProfit" INTEGER,
    "stopLoss" INTEGER,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trailingStopLossEnabled" BOOLEAN NOT NULL DEFAULT false,
    "trailingStopLossDistance" INTEGER,
    "trailingStopLossHighestPrice" INTEGER,
    "trailingStopLossLowestPrice" INTEGER,

    CONSTRAINT "order_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_provider_providerId_idx" ON "users"("provider", "providerId");

-- CreateIndex
CREATE INDEX "closed_orders_userId_idx" ON "closed_orders"("userId");

-- CreateIndex
CREATE INDEX "closed_orders_closedAt_idx" ON "closed_orders"("closedAt");

-- CreateIndex
CREATE INDEX "user_snapshots_userId_snapshotAt_idx" ON "user_snapshots"("userId", "snapshotAt");

-- CreateIndex
CREATE INDEX "order_snapshots_userId_snapshotAt_idx" ON "order_snapshots"("userId", "snapshotAt");

-- CreateIndex
CREATE INDEX "order_snapshots_orderId_snapshotAt_idx" ON "order_snapshots"("orderId", "snapshotAt");
