import { Router } from "express";
import { Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { openTradeSchema } from "../types";
import { findUSerId } from "../data/store";
import { toInternalUSD, fromInternalUSD, fromInternalPrice } from "shared";
import { PriceStorageMp } from "../data/store";
import { calculateLiquidation } from "../utils/PnL";
import { randomUUID } from "crypto";
import { Order } from "../types";
import { getUserOrders, getUserCloseOrders } from "../data/store";
import { closeOrder } from "../utils/tradeUtils";

export const tradeRoutes = Router();

tradeRoutes.post(
  "/open",
  authMiddleware,
  (req: Request, res: Response): void => {
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
      const currentPrice = PriceStorageMp.get(asset);
      if (currentPrice?.ask == 0 || currentPrice?.bid == 0 || !currentPrice) {
        res.status(503).json({
          error:
            "The Asset Price is not proplly updating still zero or Undefined",
        });
        return; // Stop here, don't create the trade
      }
      //calculation of  liquidation  price
      const entryPrice = type === "buy" ? currentPrice.ask : currentPrice.bid;
      const liquidationPrice = calculateLiquidation(entryPrice, leverage, type);
      const orderId = randomUUID();
      const orderDetails: Order = {
        orderId: orderId,
        userId: userId,
        asset: asset,
        type: type,
        margin: marginInCents,
        leverage: leverage,
        openPrice: entryPrice,
        openTimestamp: Date.now(),
        liquidationPrice: liquidationPrice,
        takeProfit: req.body.takeProfit, // takeprofit and stoploss will be taken if the user will gave the values of it
        stopLoss: req.body.stopLoss,
      };
      //deduct margin from the balalnce  basically  debited the money
      user.balance.usd_balance = user.balance.usd_balance - marginInCents;
      const userOrders = getUserOrders(userId);
      userOrders.set(orderId, orderDetails);
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
  authMiddleware,
  (req: Request, res: Response): void => {
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
    const currentPrice = PriceStorageMp.get(currentOrder.asset); //getting the closing price of that assert
    if (!currentPrice || currentPrice.ask === 0 || currentPrice.bid === 0) {
      res.status(503).json({ error: "Price data not available" });
      return;
    }
    const closePrice =
      currentOrder.type === "buy" ? currentPrice.bid : currentPrice.ask; //chossing opposte of what was choose priviouslly

    try {
      const pnl = closeOrder(userId, OrderId, closePrice, "manual");

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
      margin: fromInternalUSD(order.margin), // Convert cents to USD
      leverage: order.leverage,
      openPrice: fromInternalPrice(order.openPrice), // Convert internal to readable
      openTimestamp: order.openTimestamp,
      liquidationPrice: fromInternalPrice(order.liquidationPrice), // Convert internal to readable
      takeProfit: order.takeProfit ? fromInternalPrice(order.takeProfit) : null, // if user has given
      stopLoss: order.stopLoss ? fromInternalPrice(order.stopLoss) : null, // if user has given
    }));
    res.status(200).json({
      orders: transformedOrders,
    });
  }
);
//get the all the trades for trade history
tradeRoutes.get(
  "/history",
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
