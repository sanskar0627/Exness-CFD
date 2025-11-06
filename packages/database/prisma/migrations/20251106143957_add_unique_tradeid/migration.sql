-- CreateTable
CREATE TABLE "Trade" (
    "id" BIGSERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "tradeId" BIGINT NOT NULL,
    "timestamp" TIMESTAMPTZ(3) NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id","timestamp")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trade_tradeId_key" ON "Trade"("tradeId");

-- CreateIndex
CREATE INDEX "Trade_symbol_timestamp_idx" ON "Trade"("symbol", "timestamp");
