-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "usdBalance" BIGINT NOT NULL DEFAULT 500000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "margin" BIGINT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "asset" TEXT NOT NULL,
    "openPrice" BIGINT NOT NULL,
    "takeProfit" BIGINT,
    "stopLoss" BIGINT,
    "liquidationPrice" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closed_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalOrderId" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "margin" BIGINT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "asset" TEXT NOT NULL,
    "openPrice" BIGINT NOT NULL,
    "closePrice" BIGINT NOT NULL,
    "pnl" BIGINT NOT NULL,
    "closeReason" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closed_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "user_orders" ADD CONSTRAINT "user_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closed_orders" ADD CONSTRAINT "closed_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
