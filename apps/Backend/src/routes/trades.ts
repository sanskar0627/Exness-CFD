import { Router } from "express";
import { Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { tradeOpenRateLimit, tradeCloseRateLimit, apiRateLimit } from "../middleware/rateLimit";
import { openTradeSchema } from "../types";
import { findUSerId } from "../data/store";
import { toInternalUSD, fromInternalUSD, fromInternalPrice, toInternalPrice } from "shared";
import { PriceStorageMp } from "../data/store";
import { calculateLiquidation } from "../utils/PnL";
import { randomUUID } from "crypto";
import { Order } from "../types";
import { getUserOrders, getUserCloseOrders } from "../data/store";
import { closeOrder } from "../utils/tradeUtils";
import {
  broadcastOrderClose,
  broadcastOrderOpened,
} from "../services/orderBroadcast";

export const tradeRoutes = Router();

tradeRoutes.post(
  "/open",
  tradeOpenRateLimit,
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    //checking that from body every response is thier or not
    const { asset, type, margin, leverage } = req.body; //extracted from body
    const validation = openTradeSchema.safeParse({
      asset,
      type,
      margin,
      leverage,
    }); // opentrdaeschme checks eveything propelly
    if (!validation.success) {
      res.status(400).json({
        error: "Invalid Input",
        details: validation.error.issues,
      });
      return; //  Stop execution
    } else {
      const userId = req.userId;
      if (!userId) {
        ///Doing this for typescript error
        res.status(404).json({ error: "User not found" });
        return;
      }
      const user = findUSerId(userId);
      if (!user) {
        console.log(`[BALANCE] User not found: ${userId}`);
        res.status(404).json({ error: "User not found" });
        return;
      }
      const UserBalanceInCents = user.balance.usd_balance; //user balance is already in cents
      const marginInCents = toInternalUSD(margin);
      //checking that user has enough balance to excute the trade
      if (UserBalanceInCents < marginInCents) {
        res.status(400).json({ error: "Insufficient balance" });
        return; // Stop here, don't create the trade
      }
      //now checking the current price of the aseet ofr perfect calculation
      const priceData = PriceStorageMp.get(asset);
      if (!priceData || priceData.ask === 0 || priceData.bid === 0) {
        res.status(503).json({
          error:
            "The Asset Price is not proplly updating still zero or Undefined",
        });
        return; // Stop here, don't create the trade
      }
      //calculation of  liquidation  price
      const entryPrice = type === "buy" ? priceData.ask : priceData.bid;
      const liquidationPrice = calculateLiquidation(entryPrice, leverage, type);
      const orderId = randomUUID();

      // Handle trailing stop loss if provided
      let trailingStopLoss: Order["trailingStopLoss"] = undefined;
      if (req.body.trailingStopLoss?.enabled) {
        // CRITICAL: Use toInternalPrice (PRICE_SCALE) not toInternalUSD (USD_SCALE)
        // because trailingDistance is compared against prices, not money
        const trailingDistanceInPriceScale = toInternalPrice(req.body.trailingStopLoss.trailingDistance);
        trailingStopLoss = {
          enabled: true,
          trailingDistance: trailingDistanceInPriceScale,
          highestPrice: type === "buy" ? entryPrice : undefined,
          lowestPrice: type === "sell" ? entryPrice : undefined,
        };
      }

      const orderDetails: Order = {
        orderId: orderId,
        userId: userId,
        asset: asset,
        type: type,
        margin: marginInCents,
        initialMargin: marginInCents,
        addedMargin: 0,
        leverage: leverage,
        openPrice: entryPrice,
        openTimestamp: Date.now(),
        liquidationPrice: liquidationPrice,
        takeProfit: req.body.takeProfit, // takeprofit and stoploss will be taken if the user will gave the values of it
        stopLoss: req.body.stopLoss,
        trailingStopLoss: trailingStopLoss,
      };
      //deduct margin from the balalnce  basically  debited the money
      user.balance.usd_balance = user.balance.usd_balance - marginInCents;
      const userOrders = getUserOrders(userId);
      userOrders.set(orderId, orderDetails);
      try {
        await broadcastOrderOpened(orderDetails); //calling the function so it can send into redis
      } catch (err) {
        console.error("Failed to broadcast order, but trade succeeded:", err);
      }
      res.status(201).json({
        message: "Order created successfully",
        order: orderDetails,
      });
    }
  }
);

//close End point
tradeRoutes.post(
  "/close",
  tradeCloseRateLimit,
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const { OrderId } = req.body;
    if (!OrderId) {
      res.status(400).json({ error: "Invalid Input No OrderId Present" });
      return;
    }
    const userId = req.userId;
    if (!userId) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    //getting user order
    const userOrders = getUserOrders(userId);
    const currentOrder = userOrders.get(OrderId);
    if (!currentOrder) {
      res
        .status(404)
        .json({ error: "Invalid Input No Order and its value is  Present" });
      return;
    }
    const priceData = PriceStorageMp.get(currentOrder.asset); //getting the closing price of that assert
    if (!priceData || priceData.ask === 0 || priceData.bid === 0) {
      res.status(503).json({ error: "Price data not available" });
      return;
    }
    const closePrice =
      currentOrder.type === "buy" ? priceData.bid : priceData.ask; //chossing opposte of what was choose priviouslly

    try {
      const pnl = await closeOrder(userId, OrderId, closePrice, "manual");

      // Convert PnL from cents to dollars
      const pnlInDollars = pnl / 100;

      res.status(200).json({
        message: "Order closed successfully",
        orderId: OrderId,
        closePrice: closePrice,
        pnl: pnlInDollars, // In USD
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to close order" });
    }
  }
);
//Route to check open Position
tradeRoutes.get(
  "/open",
  apiRateLimit,
  authMiddleware,
  (req: Request, res: Response): void => {
    const userId = req.userId;
    if (!userId) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const userorder = getUserOrders(userId);
    //converted map to array  with order id and its value
    const arrayofUserorder = Array.from(userorder.values());
    const transformedOrders = arrayofUserorder.map((order) => ({
      orderId: order.orderId,
      userId: order.userId,
      asset: order.asset,
      type: order.type,
      margin: fromInternalUSD(order.margin), // Current margin in USD
      initialMargin: fromInternalUSD(order.initialMargin), // Original margin in USD
      addedMargin: fromInternalUSD(order.addedMargin), // Additional margin added
      leverage: order.leverage, // Original leverage
      effectiveLeverage: order.addedMargin > 0
        ? Number(((order.initialMargin * order.leverage) / order.margin).toFixed(2))
        : order.leverage,
      openPrice: fromInternalPrice(order.openPrice), // Convert internal to readable
      openTimestamp: order.openTimestamp,
      liquidationPrice: fromInternalPrice(order.liquidationPrice), // Convert internal to readable
      takeProfit: order.takeProfit ? fromInternalPrice(order.takeProfit) : null, // if user has given
      stopLoss: order.stopLoss ? fromInternalPrice(order.stopLoss) : null, // if user has given
      trailingStopLoss: order.trailingStopLoss ? {
        enabled: order.trailingStopLoss.enabled,
        trailingDistance: fromInternalPrice(order.trailingStopLoss.trailingDistance),
        highestPrice: order.trailingStopLoss.highestPrice ? fromInternalPrice(order.trailingStopLoss.highestPrice) : null,
        lowestPrice: order.trailingStopLoss.lowestPrice ? fromInternalPrice(order.trailingStopLoss.lowestPrice) : null,
      } : null,
    }));
    res.status(200).json({
      orders: transformedOrders,
    });
  }
);
//get the all the trades for trade history
tradeRoutes.get(
  "/history",
  apiRateLimit,
  authMiddleware,
  (req: Request, res: Response): void => {
    const userId = req.userId;
    if (!userId) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const CloseOrders = getUserCloseOrders(userId);
    const arrayofUserorder = Array.from(CloseOrders.values());
    const transformedOrders = arrayofUserorder.map((order) => ({
      orderId: order.orderId,
      userId: order.userId,
      asset: order.asset,
      type: order.type,
      margin: fromInternalUSD(order.margin), // Convert cents to USD
      leverage: order.leverage,
      openPrice: fromInternalPrice(order.openPrice), // Convert internal to readable
      openTimestamp: order.openTimestamp,
      liquidationPrice: fromInternalPrice(order.liquidationPrice), // Convert internal to readable
      takeProfit: order.takeProfit ? fromInternalPrice(order.takeProfit) : null, // if user has given
      stopLoss: order.stopLoss ? fromInternalPrice(order.stopLoss) : null, // if user has given
      closePrice: fromInternalPrice(order.closePrice), // Convert to readable
      closeTimestamp: order.closeTimestamp, // Keep as-is
      pnl: fromInternalUSD(order.pnl), // Convert cents to USD
      closeReason: order.closeReason,
    }));
    res.status(200).json({
      orders: transformedOrders,
    });
  }
);

// Partial Close endpoint - Close a percentage of an open position
tradeRoutes.post(
  "/partial-close",
  tradeCloseRateLimit,
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const { orderId, percentage } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Validate input
    const validation = { orderId: orderId, percentage: percentage };
    const partialCloseSchema = await import("../types").then(m => m.partialCloseSchema);
    const result = partialCloseSchema.safeParse(validation);
    if (!result.success) {
      res.status(400).json({ error: "Invalid input", details: result.error.issues });
      return;
    }

    const userOrders = getUserOrders(userId);
    const order = userOrders.get(orderId);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.userId !== userId) {
      res.status(403).json({ error: "Not authorized to close this order" });
      return;
    }

    // Get current price
    const priceData = PriceStorageMp.get(order.asset);
    if (!priceData || priceData.ask === 0 || priceData.bid === 0) {
      res.status(503).json({ error: "Price data not available" });
      return;
    }

    const closePrice = order.type === "buy" ? priceData.bid : priceData.ask;
    const percentageDecimal = percentage / 100;

    // Calculate margin to close
    const marginToClose = Math.floor(order.margin * percentageDecimal);
    const remainingMargin = order.margin - marginToClose;

    // Calculate PnL on closed portion using original leverage
    const { calculatePnLCents } = await import("../utils/PnL");
    const pnl = calculatePnLCents(
      order.openPrice,
      closePrice,
      marginToClose,
      order.leverage,
      order.type
    );

    // Return margin + PnL to user
    const user = findUSerId(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    user.balance.usd_balance += marginToClose + pnl;

    // Update order margin (keep position open with reduced size)
    order.margin = remainingMargin;

    // If closing 100%, handle edge case (though validation should prevent this)
    if (remainingMargin <= 0) {
      userOrders.delete(orderId);
    }

    console.log(`[PARTIAL_CLOSE] Order ${orderId}: Closed ${percentage}%, PnL: ${pnl} cents`);

    res.status(200).json({
      message: `Successfully closed ${percentage}% of position`,
      orderId: orderId,
      percentageClosed: percentage,
      marginClosed: fromInternalUSD(marginToClose),
      remainingMargin: fromInternalUSD(remainingMargin),
      pnl: fromInternalUSD(pnl),
      closePrice: fromInternalPrice(closePrice),
    });
  }
);

// Add Margin endpoint - Add more collateral to reduce liquidation risk
tradeRoutes.post(
  "/add-margin",
  apiRateLimit,
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const { orderId, additionalMargin } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Validate input
    const addMarginSchema = await import("../types").then(m => m.addMarginSchema);
    const result = addMarginSchema.safeParse({ orderId, additionalMargin });
    if (!result.success) {
      res.status(400).json({ error: "Invalid input", details: result.error.issues });
      return;
    }

    const userOrders = getUserOrders(userId);
    const order = userOrders.get(orderId);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.userId !== userId) {
      res.status(403).json({ error: "Not authorized to modify this order" });
      return;
    }

    const user = findUSerId(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const additionalMarginCents = toInternalUSD(additionalMargin);

    // Check if user has sufficient balance
    if (user.balance.usd_balance < additionalMarginCents) {
      res.status(400).json({ error: "Insufficient balance to add margin" });
      return;
    }

    // Deduct from user balance
    user.balance.usd_balance -= additionalMarginCents;

    // Update order margin
    order.addedMargin += additionalMarginCents;
    order.margin += additionalMarginCents;

    // Recalculate liquidation price with new effective leverage
    const positionSize = order.initialMargin * order.leverage; // Original position size
    const effectiveLeverage = positionSize / order.margin; // New effective leverage
    const newLiquidationPrice = calculateLiquidation(order.openPrice, effectiveLeverage, order.type);

    order.liquidationPrice = newLiquidationPrice;

    console.log(`[ADD_MARGIN] Order ${orderId}: Added ${additionalMargin} USD, new liq price: ${newLiquidationPrice}`);

    res.status(200).json({
      message: "Margin added successfully",
      orderId: orderId,
      additionalMargin: additionalMargin,
      totalMargin: fromInternalUSD(order.margin),
      initialMargin: fromInternalUSD(order.initialMargin),
      addedMargin: fromInternalUSD(order.addedMargin),
      originalLeverage: order.leverage,
      effectiveLeverage: Number(effectiveLeverage.toFixed(2)),
      newLiquidationPrice: fromInternalPrice(newLiquidationPrice),
    });
  }
);

// Get platform profit from spread (0.5% on open + 0.5% on close = 1% total)
tradeRoutes.get("/platform-profit", (req: Request, res: Response): void => {
  const allClosedOrders = getUserCloseOrders("all");
  const allOpenOrders = getUserOrders("all");

  let totalProfit = 0; // In cents
  let openTradeCount = 0;
  let closedTradeCount = 0;

  // Calculate profit from OPEN orders (0.5% spread earned when user opened position)
  allOpenOrders.forEach((order) => {
    const positionSize = order.margin * order.leverage; // Total position value in cents
    const spreadProfit = Math.floor(positionSize * 0.005); // 0.5% spread on open
    totalProfit += spreadProfit;
    openTradeCount++;
  });

  // Calculate profit from CLOSED orders (FULL 1% - 0.5% on open + 0.5% on close)
  allClosedOrders.forEach((order) => {
    const positionSize = order.margin * order.leverage; // Total position value in cents
    const spreadProfit = Math.floor(positionSize * 0.01); // 1% total spread (open + close)
    totalProfit += spreadProfit;
    closedTradeCount++;
  });

  res.status(200).json({
    totalProfit: fromInternalUSD(totalProfit), // Convert to USD
    openTrades: openTradeCount,
    closedTrades: closedTradeCount,
    totalTrades: openTradeCount + closedTradeCount,
    profitInCents: totalProfit,
  });
});
