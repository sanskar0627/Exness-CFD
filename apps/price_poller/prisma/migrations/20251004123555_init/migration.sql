-- CreateTable
CREATE TABLE "Trade" (
    "id" SERIAL NOT NULL,
    "tradeId" BIGINT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trade_tradeId_key" ON "Trade"("tradeId");
