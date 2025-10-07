import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { userService } from './userService.js';
import { cacheService } from './cacheService.js';

export class OrderService {
  async createOrder(userId: string, orderData: {
    orderType: 'buy' | 'sell';
    margin: number; // in dollars
    leverage: number;
    asset: string;
    openPrice: number; // in dollars
    takeProfit?: number;
    stopLoss?: number;
  }) {
    // Get current balance from cache (fast)
    const currentBalance = await cacheService.getUserBalance(userId);

    // Check if user has sufficient balance
    if (currentBalance < orderData.margin) {
      throw new Error('Insufficient balance');
    }

    // Create order object
    const orderId = crypto.randomUUID();
    const order = {
      id: orderId,
      userId,
      orderType: orderData.orderType,
      margin: orderData.margin,
      leverage: orderData.leverage,
      asset: orderData.asset.toUpperCase(),
      openPrice: orderData.openPrice,
      takeProfit: orderData.takeProfit || null,
      stopLoss: orderData.stopLoss || null,
      liquidationPrice: this.calculateLiquidationPrice(orderData.openPrice, orderData.leverage, orderData.orderType),
      status: 'open',
      createdAt: new Date()
    };

    // Update balance in cache immediately (instant response)
    const newBalance = currentBalance - orderData.margin;
    cacheService.updateUserBalanceCache(userId, newBalance);

    // Add order to cache
    cacheService.addOrderToCache(userId, order);

    return order;
  }

  async closeOrder(userId: string, orderId: string, closePrice: number, closeReason: 'manual' | 'take_profit' | 'stop_loss' | 'liquidation') {
    // Get order from cache first
    const userOrders = cacheService.getUserOrdersCache(userId);
    const order = userOrders.find(o => o.id === orderId && o.status === 'open');

    if (!order) {
      throw new Error('Order not found or already closed');
    }

    // Calculate P&L
    let pnl: number;
    if (order.orderType === 'buy') {
      pnl = (closePrice - order.openPrice) * order.leverage * order.margin / order.openPrice;
    } else {
      pnl = (order.openPrice - closePrice) * order.leverage * order.margin / order.openPrice;
    }

    // Update user balance (return margin + P&L)
    const currentBalance = await cacheService.getUserBalance(userId);
    const newBalance = currentBalance + order.margin + pnl;
    cacheService.updateUserBalanceCache(userId, newBalance);

    // Remove order from cache
    cacheService.removeOrderFromCache(userId, orderId);

    const closedOrder = {
      id: crypto.randomUUID(),
      userId,
      originalOrderId: orderId,
      orderType: order.orderType,
      margin: order.margin,
      leverage: order.leverage,
      asset: order.asset,
      openPrice: order.openPrice,
      closePrice,
      pnl,
      closeReason,
      openedAt: order.createdAt,
      closedAt: new Date()
    };

    return closedOrder;
  }

  private calculateLiquidationPrice(openPrice: number, leverage: number, orderType: 'buy' | 'sell'): number {
    const liquidationMultiplier = orderType === 'buy' ? (1 - 1/leverage) : (1 + 1/leverage);
    return openPrice * liquidationMultiplier;
  }
}

export const orderService = new OrderService();