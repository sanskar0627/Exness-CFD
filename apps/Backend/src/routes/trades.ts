import express from "express";
import { Router } from "express";
import { Request, Response } from "express";
import type { Asset, Leverage } from "shared";
import { authMiddleware } from "../middleware/auth";
import { openTradeSchema, OrderType } from "../types"
import { CreateUser, findUser, findUSerId, UserBalance } from "../data/store";
import { toInternalUSD } from "shared";
import { PriceStorageMp } from "../data/store"
import { calculateLiquidation } from "../utils/PnL"
import { randomUUID } from "crypto";
import { Order } from "../types";
import { getUserOrders } from "../data/store";

export const tradeRoutes = Router();

tradeRoutes.post("/open", authMiddleware, (req: Request, res: Response): void => {
    //checking that from body every response is thier or not
    const { asset, type, margin, leverage } = req.body; //extracted from body
    const validation = openTradeSchema.safeParse({ asset, type, margin, leverage });// opentrdaeschme checks eveything propelly  
    if (!validation.success) {
        res.status(400).json({
            error: "Invalid Input",
            details: validation.error.issues
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
            res.status(503).json({ error: "The Asset Price is not proplly updating still zero or Undefined" });
            return; // Stop here, don't create the trade
        }
        //calculation of  liquidation  price
        const entryPrice = type === "buy" ? currentPrice.ask : currentPrice.bid;
        const liquidationPrice = calculateLiquidation(entryPrice, leverage, type)
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
        }
        //deduct margin from the balalnce  basically  debited the money 
        user.balance.usd_balance = user.balance.usd_balance - marginInCents;
        const userOrders =getUserOrders(userId);
        userOrders.set(orderId,orderDetails);
        res.status(201).json({
            message: "Order created successfully",
            order: orderDetails
        });
    }

})