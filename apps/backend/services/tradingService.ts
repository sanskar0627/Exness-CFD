import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma.js';
import { cacheService } from './cacheService.js';
import { userService } from './userService.js';
import logger from '../utils/logger.js';

interface CreateOrderData {
  userId: string;
  orderType: 'buy' | 'sell';
  margin: number; // in dollars
  leverage: number;
  asset: string;
  openPrice: number;
  takeProfit?: number | undefined;
  stopLoss?: number | undefined;
}

interface CloseOrderData {
  orderId: string;
  closePrice: number;
  closeReason: 'manual' | 'take_profit' | 'stop_loss' | 'liquidation';
}

export class TradingService {
  
  async createOrder(data: CreateOrderData) {
    try {
      // 1. VALIDATION: Check user balance (fast cache lookup)
      const userBalance = await userService.getUserBalanceFast(data.userId);
      if (userBalance < data.margin) {
        throw new Error('Insufficient balance');
      }

      // 2. CALCULATE: Liquidation price
      const liquidationPrice = this.calculateLiquidationPrice(
        data.openPrice, 
        data.leverage, 
        data.orderType
      );

      // 3. DEDUCT: User balance (instant cache update)
      const newBalance = userBalance - data.margin;
      await userService.updateUserBalance(data.userId, newBalance);

      // 4. PERSIST: Save order to database (permanent record)
      const order = await prisma.userOrder.create({
        data: {
          userId: data.userId,
          orderType: data.orderType,
          margin: BigInt(Math.round(data.margin * 100)), // Convert to cents
          leverage: data.leverage,
          asset: data.asset,
          openPrice: BigInt(Math.round(data.openPrice)),
          takeProfit: data.takeProfit ? BigInt(Math.round(data.takeProfit)) : null,
          stopLoss: data.stopLoss ? BigInt(Math.round(data.stopLoss)) : null,
          liquidationPrice: BigInt(Math.round(liquidationPrice)),
          status: 'open'
        }
      });

      // 5. CACHE: Add to Redis for ultra-fast access
      await cacheService.addOrderToCache(data.userId, {
        id: order.id,
        userId: order.userId,
        orderType: order.orderType,
        margin: Number(order.margin) / 100,
        leverage: order.leverage,
        asset: order.asset,
        openPrice: Number(order.openPrice),
        takeProfit: order.takeProfit ? Number(order.takeProfit) : null,
        stopLoss: order.stopLoss ? Number(order.stopLoss) : null,
        liquidationPrice: Number(order.liquidationPrice),
        status: order.status,
        createdAt: order.createdAt
      });

      logger.info(`✅ Order created: ${order.id} for user ${data.userId}`);
      return { orderId: order.id };

    } catch (error) {
      logger.error('❌ Failed to create order:', error);
      throw error;
    }
  }

  async closeOrder(data: CloseOrderData) {
    try {
      // 1. FETCH: Get order from database
      const order = await prisma.userOrder.findUnique({
        where: { id: data.orderId }
      });

      if (!order || order.status !== 'open') {
        throw new Error('Order not found or already closed');
      }

      // 2. CALCULATE: PnL
      const openPrice = Number(order.openPrice);
      const margin = Number(order.margin) / 100; // Convert from cents
      const pnl = this.calculatePnL(
        openPrice,
        data.closePrice,
        margin,
        order.leverage,
        order.orderType
      );

      // 3. UPDATE: User balance (return margin + pnl)
      const currentBalance = await userService.getUserBalanceFast(order.userId);
      const newBalance = currentBalance + margin + pnl;
      await userService.updateUserBalance(order.userId, newBalance);

      // 4. PERSIST: Move order to closed_orders table
      const [updatedOrder, closedOrder] = await prisma.$transaction([
        prisma.userOrder.update({
          where: { id: data.orderId },
          data: { status: 'closed' }
        }),
        prisma.closedOrder.create({
          data: {
            userId: order.userId,
            originalOrderId: order.id,
            orderType: order.orderType,
            margin: order.margin,
            leverage: order.leverage,
            asset: order.asset,
            openPrice: order.openPrice,
            closePrice: BigInt(Math.round(data.closePrice)),
            pnl: BigInt(Math.round(pnl * 100)), // Convert to cents
            closeReason: data.closeReason,
            openedAt: order.createdAt
          }
        })
      ]);

      // 5. CACHE: Remove from active orders cache
      await cacheService.removeOrderFromCache(order.userId, data.orderId);

      logger.info(`✅ Order closed: ${data.orderId}, PnL: $${pnl.toFixed(2)}`);
      return { pnl };

    } catch (error) {
      logger.error('❌ Failed to close order:', error);
      throw error;
    }
  }

  async getUserActiveOrders(userId: string) {
    try {
      // Try cache first (ultra-fast)
      const cachedOrders = cacheService.getUserOrdersCache(userId);
      if (cachedOrders.length > 0) {
        return cachedOrders;
      }

      // Fallback to database
      const orders = await prisma.userOrder.findMany({
        where: { 
          userId,
          status: 'open'
        },
        orderBy: { createdAt: 'desc' }
      });

      // Convert BigInt to numbers for JSON serialization
      const formattedOrders = orders.map(order => ({
        id: order.id,
        userId: order.userId,
        orderType: order.orderType,
        margin: Number(order.margin) / 100,
        leverage: order.leverage,
        asset: order.asset,
        openPrice: Number(order.openPrice),
        takeProfit: order.takeProfit ? Number(order.takeProfit) : null,
        stopLoss: order.stopLoss ? Number(order.stopLoss) : null,
        liquidationPrice: Number(order.liquidationPrice),
        status: order.status,
        createdAt: order.createdAt
      }));

      return formattedOrders;

    } catch (error) {
      logger.error('❌ Failed to get user orders:', error);
      throw error;
    }
  }

  async checkLiquidations(currentPrices: Record<string, number>) {
    try {
      // Get all open orders that might be liquidated
      const openOrders = await prisma.userOrder.findMany({
        where: { status: 'open' }
      });

      for (const order of openOrders) {
        const currentPrice = currentPrices[order.asset];
        if (!currentPrice) continue;

        const liquidationPrice = Number(order.liquidationPrice);
        const shouldLiquidate = this.shouldLiquidateOrder(
          order.orderType,
          currentPrice,
          liquidationPrice
        );

        if (shouldLiquidate) {
          await this.closeOrder({
            orderId: order.id,
            closePrice: currentPrice,
            closeReason: 'liquidation'
          });
          
          logger.warn(`🔥 LIQUIDATED order ${order.id} at price ${currentPrice}`);
        }
      }

    } catch (error) {
      logger.error('❌ Failed to check liquidations:', error);
    }
  }

  private calculateLiquidationPrice(openPrice: number, leverage: number, orderType: string): number {
    if (orderType === 'buy') {
      return Math.floor(openPrice * (1 - 1 / leverage));
    } else {
      return Math.floor(openPrice * (1 + 1 / leverage));
    }
  }

  private calculatePnL(
    openPrice: number,
    closePrice: number,
    margin: number,
    leverage: number,
    orderType: string
  ): number {
    const priceChange = orderType === 'buy' 
      ? (closePrice - openPrice) / openPrice
      : (openPrice - closePrice) / openPrice;
    
    return priceChange * margin * leverage;
  }

  private shouldLiquidateOrder(
    orderType: string,
    currentPrice: number,
    liquidationPrice: number
  ): boolean {
    if (orderType === 'buy') {
      return currentPrice <= liquidationPrice;
    } else {
      return currentPrice >= liquidationPrice;
    }
  }
}

export const tradingService = new TradingService();