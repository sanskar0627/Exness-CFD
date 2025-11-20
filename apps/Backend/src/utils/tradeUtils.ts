import {getUserOrders,getUserCloseOrders, findUSerId,UserBalance,} from "../data/store";
import { reasonForClose, ClosedOrder } from "../types";
import { calculatePnLCents } from "./PnL";

export function closeOrder(userId: string,orderId: string,closePrice: number,closeReason: reasonForClose): number {
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

  const closedOrder: ClosedOrder = {
    ...order,
    closePrice: closePrice,
    closeTimestamp: Date.now(),
    pnl: pnl,
    closeReason: closeReason,
  };

  const userClosedOrders = getUserCloseOrders(userId);
  userClosedOrders.set(orderId, closedOrder);
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
