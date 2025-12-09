-- DropIndex
DROP INDEX "public"."order_snapshots_userId_snapshotAt_idx";

-- CreateTable
CREATE TABLE "active_orders" (
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trailingStopLossEnabled" BOOLEAN NOT NULL DEFAULT false,
    "trailingStopLossDistance" INTEGER,
    "trailingStopLossHighestPrice" INTEGER,
    "trailingStopLossLowestPrice" INTEGER,

    CONSTRAINT "active_orders_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE INDEX "active_orders_userId_idx" ON "active_orders"("userId");
