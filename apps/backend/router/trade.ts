import { Router } from "express";
import { usermiddleware } from "../middleware/auth.js";
import { tradeSchema } from "../schemas/validationSchemas.js";
import { tradingService } from "../services/tradingService.js";
import { RedisManager } from "../utils/redisClient.js";

export const tradeRouter = Router();

tradeRouter.post("/", usermiddleware, async (req, res) => {
  try {
    const tradeschema = tradeSchema.safeParse(req.body);
    if (!tradeschema.success) {
      console.error("❌ Trade validation failed:", tradeschema.error.errors);
      console.error("📦 Received payload:", req.body);
      return res.status(411).json({ 
        message: "Incorrect inputs",
        errors: tradeschema.error.errors 
      });
    }
    
    let { asset, type, margin, leverage, takeProfit, stopLoss } = tradeschema.data;

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Remove USDT suffix if present
    if (asset && asset.endsWith("USDT")) {
      asset = asset.replace("USDT", "") as any;
    }

    // Get current price from Redis
    const currentPrice = await RedisManager.getCurrentPrice(asset);
    if (!currentPrice) {
      return res.status(411).json({ message: "Invalid asset or price not available" });
    }

    const openPrice = type === "buy" ? currentPrice.ask : currentPrice.bid;

    // Create order using the new trading service
    const result = await tradingService.createOrder({
      userId,
      orderType: type,
      margin,
      leverage,
      asset,
      openPrice,
      ...(takeProfit && { takeProfit }),
      ...(stopLoss && { stopLoss })
    });

    return res.status(200).json({ orderId: result.orderId });
  } catch (error) {
    if (error instanceof Error && error.message === 'Insufficient balance') {
      return res.status(400).json({ message: error.message });
    }
    
    console.error("Error while creating trade:", error);
    return res.status(500).json({ message: "Server error during trade creation" });
  }
});

tradeRouter.post("/close", usermiddleware, async (req, res) => {
  try {
    const { orderid } = req.body;
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!orderid) {
      return res.status(400).json({ message: "Order ID required" });
    }

    // Get the order to find which asset we're dealing with
    const orders = await tradingService.getUserActiveOrders(userId);
    const order = orders.find(o => o.id === orderid);
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Get current price for the asset
    const currentPrice = await RedisManager.getCurrentPrice(order.asset);
    if (!currentPrice) {
      return res.status(400).json({ message: "Cannot get current price for asset" });
    }

    const closePrice = order.orderType === "buy" ? currentPrice.bid : currentPrice.ask;

    // Close order using the new trading service
    const result = await tradingService.closeOrder({
      orderId: orderid,
      closePrice,
      closeReason: 'manual'
    });

    return res.status(200).json({
      message: "Position closed successfully",
      pnl: result.pnl,
    });
  } catch (error) {
    console.error("Error while closing trade:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});