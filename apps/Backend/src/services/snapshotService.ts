import { prisma } from "database";
import { StoreData, orderStorageMap } from "../data/store";
import { SnapShot_Interval } from "../types";

const SNAPSHOT_INTERVAL = 10000; // 10 seconds
let snapshotTimer: NodeJS.Timeout | null = null;

async function saveSnapshot() {
  try {
    const startTime = Date.now();

    // 1. Save user balances
    const users = Array.from(StoreData.values());
    const userSnapshots = users.map((user) => ({
      userId: user.userId,
      balanceCents: user.balance.usd_balance,
    }));

    if (userSnapshots.length > 0) {
      await prisma.userSnapshot.createMany({
        data: userSnapshots,
      });
    }

    // 2. Save open orders
    const allOrders: any[] = [];
    orderStorageMap.forEach((userOrders) => {
      userOrders.forEach((order) => {
        allOrders.push({
          orderId: order.orderId,
          userId: order.userId,
          asset: order.asset,
          type: order.type,
          margin: order.margin,
          leverage: order.leverage,
          openPrice: order.openPrice,
          liquidationPrice: order.liquidationPrice,
          takeProfit: order.takeProfit || null,
          stopLoss: order.stopLoss || null,
          openedAt: new Date(order.openTimestamp),
        });
      });
    });

    if (allOrders.length > 0) {
      await prisma.orderSnapshot.createMany({
        data: allOrders,
      });
    }

    const duration = Date.now() - startTime;
    console.log(
      `[SNAPSHOT] Saved ${userSnapshots.length} users, ${allOrders.length} orders in ${duration}ms`
    );
  } catch (error) {
    console.error("[SNAPSHOT] Error saving snapshot:", error);
  }
}

export function startSnapshotService() {
  console.log("[SNAPSHOT] Starting snapshot service...");
  saveSnapshot(); // Save immediately on startup
  snapshotTimer = setInterval(saveSnapshot, SNAPSHOT_INTERVAL);
  console.log(`[SNAPSHOT] Service started (interval: ${SNAPSHOT_INTERVAL}ms)`);
}

export function stopSnapshotService() {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
    console.log("[SNAPSHOT] Service stopped");
  }
}
