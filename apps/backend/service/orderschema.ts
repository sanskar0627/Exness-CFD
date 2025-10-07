import { tradingService } from "../services/tradingService.js";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";

export async function checkOpenPositions(
  asset: string,
  newPrice: { ask: number; bid: number },
) {
  try {
    // Get all open orders for this specific asset
    const openOrders = await prisma.userOrder.findMany({
      where: { 
        asset: asset,
        status: 'open'
      }
    });

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
        } catch (error) {
          logger.error(`❌ Failed to auto-close order ${order.id}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error(`❌ Failed to check open positions for ${asset}:`, error);
  }
}