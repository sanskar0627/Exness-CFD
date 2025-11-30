import { calculatePnLCents } from "../utils/PnL";
import { getCurrentPrice } from "./priceMonitor";
import { Order, IncomingredisPriceData } from "../types";
import { Asset } from "shared";
import { orderStorageMap } from "../data/store";

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
