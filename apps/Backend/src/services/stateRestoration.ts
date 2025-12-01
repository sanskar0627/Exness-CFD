import { prisma } from "database";
import { StoreData, orderStorageMap } from "../data/store";
import type { Asset } from "shared";

export async function restoreState() {
  try {
    console.log("[RESTORE] Starting state restoration from database...");
    const startTime = Date.now();

    // 1. Load all users from users table
    const users = await prisma.user.findMany();

    users.forEach((user) => {
      StoreData.set(user.userId, {
        userId: user.userId,
        email: user.email,
        password: user.password,
        balance: { usd_balance: user.balanceCents },
        assets: {} as Record<Asset, number>,
      });
    });

    console.log(`[RESTORE] Loaded ${users.length} users into memory`);

    // 2. Load latest order snapshots
    const orderSnapshots = await prisma.orderSnapshot.findMany({
      orderBy: { snapshotAt: "desc" },
    });

    // Group by orderId and take first (latest) of each
    const latestOrders = new Map();
    orderSnapshots.forEach((snapshot) => {
      if (!latestOrders.has(snapshot.orderId)) {
        latestOrders.set(snapshot.orderId, snapshot);
      }
    });

    // Load orders into orderStorageMap
    latestOrders.forEach((snapshot) => {
      let userOrders = orderStorageMap.get(snapshot.userId);
      if (!userOrders) {
        userOrders = new Map();
        orderStorageMap.set(snapshot.userId, userOrders);
      }

      userOrders.set(snapshot.orderId, {
        orderId: snapshot.orderId,
        userId: snapshot.userId,
        asset: snapshot.asset as Asset,
        type: snapshot.type as "buy" | "sell",
        margin: snapshot.margin,
        leverage: snapshot.leverage as 1 | 5 | 10 | 20 | 100,
        openPrice: snapshot.openPrice,
        liquidationPrice: snapshot.liquidationPrice,
        takeProfit: snapshot.takeProfit || undefined,
        stopLoss: snapshot.stopLoss || undefined,
        openTimestamp: snapshot.openedAt.getTime(),
      });
    });

    const duration = Date.now() - startTime;
    console.log(
      `[RESTORE]  State restored: ${users.length} users, ${latestOrders.size} open orders in ${duration}ms`
    );
  } catch (error) {
    console.error("[RESTORE]  Error restoring state:", error);
    throw error;
  }
}
