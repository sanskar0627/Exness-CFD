import { calculatePnLCents } from "../utils/PnL";
import { getCurrentPrice } from "./priceMonitor";
import { Order, IncomingredisPriceData } from "../types";
import { Asset } from "shared";
import { getUserOrders } from "../data/store";

export interface PnLData {
  orderId: string;
  pnl: number; // PnL in cents
  pnlPercent: number; // Percentage of margin
  currentPrice: number; // Price used for calculation
  checkTime: number; // When calculated (Unix timestamp in seconds)
}

export function calculateCurrentPnL(
  order: Order,
  currentPrice: IncomingredisPriceData | null
): number | null {
  try {
    // Check if currentPrice exists
    if (!currentPrice) {
      console.log("Current Price is not available to calculate PnL");
      return null;
    }
    // Determine which price to use based on order type
    let currentPricee: number;
    if (order.type === "buy") {
      currentPricee = currentPrice.bidPrice; // Use bid for long positions (sell to close)
    } else {
      currentPricee = currentPrice.askPrice; // Use ask for short positions (buy to close)
    }

    // Validate the price
    if (!currentPricee || currentPricee <= 0) {
      console.log("Invalid price for PnL calculation");
      return null;
    }

    // Calculate PnL using existing function
    const pnL = calculatePnLCents(
      order.openPrice,
      currentPricee,
      order.margin,
      order.leverage,
      order.type
    );

    return pnL;
  } catch (err) {
    console.error("Error calculating current PnL:", err);
    return null;
  }
}

// /// here we are not optimizing it but we can optimize it futher also like we are using simple looping but  we can use batch optimization in it eg:-  Group all BTC orders together
//   - Get BTC price once
//   - Calculate PnL for all BTC orders
//   - Repeat for ETH, SOL
//   - More efficient but more complex
export async function calculateAllPnL(): Promise<Map<string, PnLData>> {
  try {
    // Get all open orders from all users
    const allOrders = getUserOrders("all");
    const resultMap = new Map<string, PnLData>();

    let totalOrders = 0;
    let successfulCalculations = 0;
    let skippedOrders = 0;

    console.log(
      `[PnL] Starting PnL calculation for ${allOrders.size} positions`
    );

    // Loop through each order using for...of to handle async properly
    for (const [orderId, order] of allOrders.entries()) {
      totalOrders++;

      try {
        // Get current price for this order's asset
        const currentPrice = await getCurrentPrice(order.asset);

        // Skip if price not available
        if (!currentPrice) {
          console.log(
            `[PnL] Skipping order ${orderId}: Price unavailable for ${order.asset}`
          );
          skippedOrders++;
          continue; // Continue to next order
        }

        // Calculate PnL for this order
        const pnl = calculateCurrentPnL(order, currentPrice);

        // Skip if PnL calculation failed
        if (pnl === null) {
          console.log(
            `[PnL] Skipping order ${orderId}: PnL calculation failed`
          );
          skippedOrders++;
          continue; // Continue to next order
        }

        // Calculate PnL percentage of margin
        const pnlPercent = order.margin > 0 ? (pnl / order.margin) * 100 : 0;

        // Determine which price was used based on order type
        const priceUsed =
          order.type === "buy" ? currentPrice.bidPrice : currentPrice.askPrice;

        // Get current timestamp in seconds
        const checkTime = Math.floor(Date.now() / 1000);

        // Create PnLData object
        const pnlData: PnLData = {
          orderId: orderId,
          pnl: pnl,
          pnlPercent: pnlPercent,
          currentPrice: priceUsed,
          checkTime: checkTime,
        };

        // Add to result map
        resultMap.set(orderId, pnlData);
        successfulCalculations++;
      } catch (err) {
        // Log error for individual order but continue processing others
        console.error(`[PnL] Error processing order ${orderId}:`, err);
        skippedOrders++;
      }
    }

    console.log(
      `[PnL] Calculation complete: ${successfulCalculations} successful, ${skippedOrders} skipped out of ${totalOrders} total`
    );

    return resultMap;
  } catch (err) {
    // Critical error - log and return empty map
    console.error("[PnL] Critical error in calculateAllPnL:", err);
    return new Map<string, PnLData>();
  }
}
