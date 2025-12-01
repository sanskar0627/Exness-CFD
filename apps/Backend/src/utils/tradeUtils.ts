import {getUserOrders,getUserCloseOrders, findUSerId,UserBalance,} from "../data/store";
import { reasonForClose, ClosedOrder } from "../types";
import { calculatePnLCents } from "./PnL";
import { broadcastOrderClose } from "../services/orderBroadcast";
import { prisma } from "database";


export  async function closeOrder(userId: string,orderId: string,closePrice: number,closeReason: reasonForClose): Promise<number> {
  const userOrders = getUserOrders(userId); //ggeting all the user with  ordeid and orders 
  const order = userOrders.get(orderId);

  if (!order) {
    throw new Error(`Order ${orderId} not found for user ${userId}`);
  }

  const pnl = calculatePnLCents(
    order.openPrice,
    closePrice,
    order.margin,
    order.leverage,
    order.type
  );
   await prisma.closedOrder.create({
    data: {
      orderId: order.orderId,
      userId: order.userId,
      asset: order.asset,
      type: order.type,
      margin: order.margin,
      leverage: order.leverage,
      openPrice: order.openPrice,
      closePrice: closePrice,
      liquidationPrice: order.liquidationPrice,
      takeProfit: order.takeProfit,
      stopLoss: order.stopLoss,
      pnl: pnl,
      closeReason: closeReason.toUpperCase(),
      closeMessage: null,
      openedAt: new Date(order.openTimestamp),
      closedAt: new Date()
    }
  });

  const closedOrder: ClosedOrder = {
    ...order,
    closePrice: closePrice,
    closeTimestamp: Date.now(),
    pnl: pnl,
    closeReason: closeReason,
  };

  const userClosedOrders = getUserCloseOrders(userId);
  userClosedOrders.set(orderId, closedOrder);
  try{
  await broadcastOrderClose(closedOrder, closeReason)
  }catch(err){
    console.error("Failed to broadcast order close, but order closed successfully:", err);
  }
  userOrders.delete(orderId);

  const user = findUSerId(userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  const newBalance = user.balance.usd_balance + order.margin + pnl;
  UserBalance(userId, newBalance);

  console.log(
    `[CLOSE ORDER] User: ${userId} | Order: ${orderId} | PnL: ${pnl} cents | Reason: ${closeReason}`
  );

  return pnl
}
