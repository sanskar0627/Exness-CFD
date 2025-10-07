import { Router } from "express";
import { usermiddleware } from "../middleware/auth.js";
import { tradingService } from "../services/tradingService.js";
import { userService } from "../services/userService.js";

export const tradesRouter = Router();

tradesRouter.get("/open", usermiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    const trades = await tradingService.getUserActiveOrders(userId);

    const formattedTrades = trades.map(order => ({
      orderId: order.id,
      type: order.orderType,
      margin: order.margin,
      leverage: order.leverage,
      asset: order.asset,
      openPrice: order.openPrice,
      takeProfit: order.takeProfit,
      stopLoss: order.stopLoss,
      liquidationPrice: order.liquidationPrice,
      createdAt: order.createdAt
    }));

    return res.status(200).json({
      trades: formattedTrades,
    });
  } catch (error) {
    console.error('Error fetching open trades:', error);
    return res.status(500).json({
      message: "Internal server error while fetching open trades"
    });
  }
});

tradesRouter.get("/", usermiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const closedOrders = await userService.getClosedOrders(userId);

    const formattedTrades = closedOrders.map(order => ({
      orderId: order.id,
      originalOrderId: order.originalOrderId,
      type: order.orderType,
      margin: Number(order.margin) / 100, // Convert from cents to dollars
      leverage: order.leverage,
      asset: order.asset,
      openPrice: Number(order.openPrice),
      closePrice: Number(order.closePrice),
      pnl: Number(order.pnl) / 100, // Convert from cents to dollars
      closeReason: order.closeReason,
      openedAt: order.openedAt,
      closedAt: order.closedAt
    }));

    return res.status(200).json({
      trades: formattedTrades,
    });
  } catch (error) {
    console.error('Error fetching closed trades:', error);
    return res.status(500).json({
      message: "Internal server error while fetching closed trades"
    });
  }
});

tradesRouter.post("/orders", (req, res) => {
  const query = req.query;
  // This endpoint can be implemented later if needed
  res.status(501).json({ message: "Not implemented yet" });
});