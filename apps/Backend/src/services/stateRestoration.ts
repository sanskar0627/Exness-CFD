import { prisma } from "database";
import { StoreData, orderStorageMap, emailToUserId } from "../data/store";
import type { Asset } from "shared";

export async function restoreState() {
  try {
    console.log("[RESTORE] Starting state restoration from database...");
    const startTime = Date.now();

    // CRITICAL FIX: Delete old ActiveOrder records that are missing initialMargin field
    // These are from before the field was added and will cause errors
    try {
      const deleteResult = await prisma.activeOrder.deleteMany({
        where: {
          initialMargin: undefined,
        },
      });
      if (deleteResult.count > 0) {
        console.log(`[RESTORE] Cleaned up ${deleteResult.count} old orders missing initialMargin field`);
      }
    } catch (cleanupError) {
      console.warn("[RESTORE] Could not clean up old orders, continuing anyway:", cleanupError);
    }

    // 1. Load all users from users table
    const users = await prisma.user.findMany();

    users.forEach((user) => {
      StoreData.set(user.userId, {
        userId: user.userId,
        email: user.email,
        password: user.password || "", // Handle OAuth users with empty password
        balance: { usd_balance: user.balanceCents },
        assets: {} as Record<Asset, number>,
      });
      // CRITICAL FIX: Populate emailToUserId map for findUser() to work after restart
      emailToUserId.set(user.email, user.userId);
    });

    console.log(`[RESTORE] Loaded ${users.length} users into memory`);

    // 2. Load active orders from database
    const activeOrders = await prisma.activeOrder.findMany();

    // Load orders into orderStorageMap
    activeOrders.forEach((order: any) => {
      let userOrders = orderStorageMap.get(order.userId);
      if (!userOrders) {
        userOrders = new Map();
        orderStorageMap.set(order.userId, userOrders);
      }

      userOrders.set(order.orderId, {
        orderId: order.orderId,
        userId: order.userId,
        asset: order.asset as Asset,
        type: order.type as "buy" | "sell",
        margin: order.margin,
        initialMargin: order.initialMargin,
        addedMargin: order.addedMargin,
        leverage: order.leverage as 1 | 5 | 10 | 20 | 100,
        openPrice: order.openPrice,
        liquidationPrice: order.liquidationPrice,
        takeProfit: order.takeProfit || undefined,
        stopLoss: order.stopLoss || undefined,
        openTimestamp: order.openedAt.getTime(),
        trailingStopLoss: order.trailingStopLossEnabled ? {
          enabled: true,
          trailingDistance: order.trailingStopLossDistance || 0,
          highestPrice: order.trailingStopLossHighestPrice || undefined,
          lowestPrice: order.trailingStopLossLowestPrice || undefined,
        } : undefined,
      });
    });

    console.log(
      `[RESTORE]  State restored: ${users.length} users, ${activeOrders.length} active orders in ${Date.now() - startTime}ms`
    );
  } catch (error) {
    console.error("[RESTORE]  Error restoring state:", error);
    throw error;
  }
}
