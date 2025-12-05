import { prisma } from "database";
import { getUserOrders } from "../data/store";
import { Order } from "../types";

// Cache for platform profit (updated in real-time)
let cachedPlatformProfit = {
  totalProfit: 0, // In cents
  openTrades: 0,
  closedTrades: 0,
  totalTrades: 0,
  lastUpdated: Date.now(),
};

/**
 * Save platform profit to database
 * Uses upsert to ensure atomic operation
 */
async function savePlatformProfitToDb() {
  try {
    await prisma.platformProfit.upsert({
      where: { id: 1 },
      update: {
        totalProfit: cachedPlatformProfit.totalProfit,
        openTrades: cachedPlatformProfit.openTrades,
        closedTrades: cachedPlatformProfit.closedTrades,
        totalTrades: cachedPlatformProfit.totalTrades,
      },
      create: {
        id: 1,
        totalProfit: cachedPlatformProfit.totalProfit,
        openTrades: cachedPlatformProfit.openTrades,
        closedTrades: cachedPlatformProfit.closedTrades,
        totalTrades: cachedPlatformProfit.totalTrades,
      },
    });
  } catch (error) {
    console.error("[PLATFORM_PROFIT] Error saving to database:", error);
    // Don't throw - we don't want to block trade operations if DB write fails
  }
}

/**
 * Initialize platform profit from database on startup
 * If no record exists, calculate from scratch and create initial record
 */
export async function initPlatformProfit() {
  try {
    console.log("[PLATFORM_PROFIT] Initializing platform profit cache...");
    const startTime = Date.now();

    // Try to load from database first
    const dbRecord = await prisma.platformProfit.findUnique({
      where: { id: 1 },
    });

    if (dbRecord) {
      // Load from database - this is the source of truth
      cachedPlatformProfit = {
        totalProfit: dbRecord.totalProfit,
        openTrades: dbRecord.openTrades,
        closedTrades: dbRecord.closedTrades,
        totalTrades: dbRecord.totalTrades,
        lastUpdated: Date.now(),
      };

      const duration = Date.now() - startTime;
      console.log(
        `[PLATFORM_PROFIT] Loaded from database: $${(cachedPlatformProfit.totalProfit / 100).toFixed(2)} (${cachedPlatformProfit.totalTrades} trades) in ${duration}ms`
      );
    } else {
      // First run - calculate from scratch and save to database
      console.log("[PLATFORM_PROFIT] No database record found, calculating from scratch...");

      // Get count of closed orders from database
      const closedOrderCount = await prisma.closedOrder.count();

      // Calculate profit from closed orders
      // For each closed order:
      // - Total margin that passed through = initialMargin + addedMargin
      // - We charge 0.5% on entry (when margin enters)
      // - We charge 0.5% on exit (when margin exits)
      // - Total fee = 1% of total margin that passed through
      // This is true regardless of partial closes, because sum(entries) = sum(exits)
      const closedOrders = await prisma.closedOrder.findMany({
        select: {
          initialMargin: true,
          addedMargin: true,
        },
      });

      let closedProfit = 0;
      closedOrders.forEach((order) => {
        const totalMarginThroughPosition = order.initialMargin + order.addedMargin;
        const totalFee = Math.floor(totalMarginThroughPosition * 0.01); // 1% of total margin
        closedProfit += totalFee;
      });

      // Get open orders from memory
      // For each open order:
      // - We've collected entry fees: 0.5% × (initialMargin + addedMargin)
      // - We haven't collected exit fees yet (position still open)
      const allOpenOrders = getUserOrders("all");
      let openProfit = 0;
      let openTradeCount = 0;

      allOpenOrders.forEach((order) => {
        const totalMarginEntered = order.initialMargin + order.addedMargin;
        const entryFee = Math.floor(totalMarginEntered * 0.005); // 0.5% on entry
        openProfit += entryFee;
        openTradeCount++;
      });

      // Update cache
      cachedPlatformProfit = {
        totalProfit: closedProfit + openProfit,
        openTrades: openTradeCount,
        closedTrades: closedOrderCount,
        totalTrades: openTradeCount + closedOrderCount,
        lastUpdated: Date.now(),
      };

      // Save initial state to database
      await savePlatformProfitToDb();

      const duration = Date.now() - startTime;
      console.log(
        `[PLATFORM_PROFIT] Initialized from scratch: $${(cachedPlatformProfit.totalProfit / 100).toFixed(2)} (${cachedPlatformProfit.totalTrades} trades) in ${duration}ms`
      );
    }
  } catch (error) {
    console.error("[PLATFORM_PROFIT] Error initializing:", error);
    throw error;
  }
}

/**
 * Order opened: Earn 0.5% of initial margin deposited
 */
export function onOrderOpened(order: Order) {
  const fee = Math.floor(order.initialMargin * 0.005); // 0.5% of initial margin

  cachedPlatformProfit.totalProfit += fee;
  cachedPlatformProfit.openTrades++;
  cachedPlatformProfit.totalTrades++;
  cachedPlatformProfit.lastUpdated = Date.now();

  console.log(
    `[PLATFORM_PROFIT] Order opened: +$${(fee / 100).toFixed(2)} (0.5% of $${(order.initialMargin / 100).toFixed(2)}) | Total: $${(cachedPlatformProfit.totalProfit / 100).toFixed(2)}`
  );

  // Persist to database (async, non-blocking)
  savePlatformProfitToDb();
}

/**
 * Order fully closed: Earn 0.5% of remaining margin amount
 */
export function onOrderClosed(order: Order) {
  const fee = Math.floor(order.margin * 0.005); // 0.5% of remaining margin at close

  cachedPlatformProfit.totalProfit += fee;
  cachedPlatformProfit.openTrades--;
  cachedPlatformProfit.closedTrades++;
  cachedPlatformProfit.lastUpdated = Date.now();

  console.log(
    `[PLATFORM_PROFIT] Order closed: +$${(fee / 100).toFixed(2)} (0.5% of $${(order.margin / 100).toFixed(2)}) | Total: $${(cachedPlatformProfit.totalProfit / 100).toFixed(2)}`
  );

  // Persist to database (async, non-blocking)
  savePlatformProfitToDb();
}

/**
 * Partial close: Earn 0.5% of the exact amount being closed
 */
export function onOrderPartialClose(marginClosedInCents: number) {
  const fee = Math.floor(marginClosedInCents * 0.005); // 0.5% of closed amount

  cachedPlatformProfit.totalProfit += fee;
  cachedPlatformProfit.lastUpdated = Date.now();

  console.log(
    `[PLATFORM_PROFIT] Partial close: +$${(fee / 100).toFixed(2)} (0.5% of $${(marginClosedInCents / 100).toFixed(2)}) | Total: $${(cachedPlatformProfit.totalProfit / 100).toFixed(2)}`
  );

  // Persist to database (async, non-blocking)
  savePlatformProfitToDb();
}

/**
 * Margin added: Earn 0.5% of the exact amount added
 */
export function onMarginAdded(additionalMarginInCents: number) {
  const fee = Math.floor(additionalMarginInCents * 0.005); // 0.5% of added margin

  cachedPlatformProfit.totalProfit += fee;
  cachedPlatformProfit.lastUpdated = Date.now();

  console.log(
    `[PLATFORM_PROFIT] Margin added: +$${(fee / 100).toFixed(2)} (0.5% of $${(additionalMarginInCents / 100).toFixed(2)}) | Total: $${(cachedPlatformProfit.totalProfit / 100).toFixed(2)}`
  );

  // Persist to database (async, non-blocking)
  savePlatformProfitToDb();
}

/**
 * Get current platform profit (instant - no database query!)
 */
export function getPlatformProfit() {
  return {
    ...cachedPlatformProfit,
    profitInCents: cachedPlatformProfit.totalProfit,
  };
}
