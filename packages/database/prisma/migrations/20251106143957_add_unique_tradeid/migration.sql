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

-- CreateIndex (includes timestamp for TimescaleDB compatibility)
CREATE UNIQUE INDEX "Trade_tradeId_timestamp_key" ON "Trade"("tradeId", "timestamp");

-- CreateIndex
CREATE INDEX "Trade_symbol_timestamp_idx" ON "Trade"("symbol", "timestamp");
