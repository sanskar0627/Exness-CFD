import { tradingService } from "../services/tradingService.js";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";

// Cache for open orders to reduce database queries
let openOrdersCache: Map<string, any[]> = new Map();
let lastCacheUpdate = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

async function updateOrdersCache() {
  try {
    const now = Date.now();
    if (now - lastCacheUpdate < CACHE_DURATION) {
      return; // Use cached data
    }

    const allOpenOrders = await prisma.userOrder.findMany({
      where: { status: 'open' }
    });

    // Group orders by asset
    openOrdersCache.clear();
    for (const order of allOpenOrders) {
      const asset = order.asset;
      if (!openOrdersCache.has(asset)) {
        openOrdersCache.set(asset, []);
      }
      openOrdersCache.get(asset)!.push(order);
    }

    lastCacheUpdate = now;
    logger.info(`🔄 Updated orders cache: ${allOpenOrders.length} open orders`);
  } catch (error) {
    logger.error('❌ Failed to update orders cache:', error);
  }
}

export async function checkOpenPositions(
  asset: string,
  newPrice: { ask: number; bid: number },
) {
  try {
    // Update cache if needed
    await updateOrdersCache();
    
    // Get orders from cache
    const openOrders = openOrdersCache.get(asset) || [];
    
    if (openOrders.length === 0) {
      return; // No open orders for this asset
    }

    for (const order of openOrders) {
      const openPrice = Number(order.openPrice);
      const takeProfit = order.takeProfit ? Number(order.takeProfit) : null;
      const stopLoss = order.stopLoss ? Number(order.stopLoss) : null;
      const liquidationPrice = order.liquidationPrice ? Number(order.liquidationPrice) : null;

      let shouldClose = false;
      let closeReason: 'take_profit' | 'stop_loss' | 'liquidation' | null = null;
      let closePrice = 0;

      // Check Take Profit
      if (takeProfit) {
        if (order.orderType === "buy" && newPrice.bid >= takeProfit) {
          shouldClose = true;
          closeReason = "take_profit";
          closePrice = newPrice.bid;
        } else if (order.orderType === "sell" && newPrice.ask <= takeProfit) {
          shouldClose = true;
          closeReason = "take_profit";
          closePrice = newPrice.ask;
        }
      }

      // Check Stop Loss
      if (!shouldClose && stopLoss) {
        if (order.orderType === "buy" && newPrice.bid <= stopLoss) {
          shouldClose = true;
          closeReason = "stop_loss";
          closePrice = newPrice.bid;
        } else if (order.orderType === "sell" && newPrice.ask >= stopLoss) {
          shouldClose = true;
          closeReason = "stop_loss";
          closePrice = newPrice.ask;
        }
      }

      // Check Liquidation
      if (!shouldClose && liquidationPrice) {
        if (order.orderType === "buy" && newPrice.bid <= liquidationPrice) {
          shouldClose = true;
          closeReason = "liquidation";
          closePrice = newPrice.bid;
        } else if (order.orderType === "sell" && newPrice.ask >= liquidationPrice) {
          shouldClose = true;
          closeReason = "liquidation";
          closePrice = newPrice.ask;
        }
      }

      // Close the order if any condition is met
      if (shouldClose && closeReason) {
        try {
          await tradingService.closeOrder({
            orderId: order.id,
            closePrice: closePrice,
            closeReason: closeReason
          });
          
          logger.info(`✅ Auto-closed order ${order.id} (${closeReason}) at price ${closePrice}`);
          
          // Remove from cache since it's now closed
          const assetOrders = openOrdersCache.get(asset) || [];
          const updatedOrders = assetOrders.filter(o => o.id !== order.id);
          openOrdersCache.set(asset, updatedOrders);
          
        } catch (error) {
          logger.error(`❌ Failed to auto-close order ${order.id}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error(`❌ Failed to check open positions for ${asset}:`, error);
  }
}