import { createClient } from 'redis';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import prisma from '../lib/prisma.js';

class SimpleCacheService {
  private client: ReturnType<typeof createClient> | null = null;
  private userBalanceCache = new Map<string, number>();

  async initialize() {
    try {
      this.client = createClient({ url: config.REDIS_URL });
      await this.client.connect();
      logger.info('✅ Cache service initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize cache service', error);
      throw error;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.client) throw new Error('Cache not initialized');
    
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) throw new Error('Cache not initialized');
    
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async delete(key: string): Promise<void> {
    if (!this.client) throw new Error('Cache not initialized');
    await this.client.del(key);
  }

  // User balance methods for backward compatibility
  async getUserBalance(userId: string): Promise<number> {
    if (this.userBalanceCache.has(userId)) {
      return this.userBalanceCache.get(userId)!;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { usdBalance: true }
    });

    const balance = user ? Number(user.usdBalance) / 100 : 0;
    this.userBalanceCache.set(userId, balance);
    return balance;
  }

  updateUserBalanceCache(userId: string, newBalance: number) {
    this.userBalanceCache.set(userId, newBalance);
    // Sync to database immediately for now
    this.syncUserBalance(userId, newBalance);
  }

  private async syncUserBalance(userId: string, balance: number) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { usdBalance: BigInt(Math.round(balance * 100)) }
      });
    } catch (error) {
      logger.error('Failed to sync user balance', { userId, balance, error });
    }
  }

  // Order cache methods (simplified to use Redis)
  getUserOrdersCache(userId: string): any[] {
    // For now, return empty array - can be enhanced later
    return [];
  }

  addOrderToCache(userId: string, order: any) {
    // Store in Redis with user prefix
    this.set(`orders:${userId}:${order.id}`, order, 3600); // 1 hour TTL
  }

  removeOrderFromCache(userId: string, orderId: string) {
    this.delete(`orders:${userId}:${orderId}`);
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      logger.info('Cache service disconnected');
    }
  }
}

export const cacheService = new SimpleCacheService();