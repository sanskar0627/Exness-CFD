-- CreateTable
CREATE TABLE "platform_profit" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "totalProfit" INTEGER NOT NULL,
    "openTrades" INTEGER NOT NULL,
    "closedTrades" INTEGER NOT NULL,
    "totalTrades" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_profit_pkey" PRIMARY KEY ("id")
);
