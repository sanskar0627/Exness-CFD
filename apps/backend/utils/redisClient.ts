import { createClient } from "redis";
import type { RedisClientType } from "redis";

export class RedisManager {
  private static instance: RedisManager;
  private pubclient: RedisClientType;
  private subclient: RedisClientType;

  private constructor() {
    this.pubclient = createClient({
      url: "redis://localhost:6379",
    });
    this.subclient = createClient({
      url: "redis://localhost:6379",
    });
  }

  static async getInstance() {
    if (!RedisManager.instance) {
      const manager = new RedisManager();
      await manager.connect();
      RedisManager.instance = manager;
    }
    return RedisManager.instance;
  }

  private async connect() {
    await this.pubclient.connect();
    await this.subclient.connect();
  }

  async publish(channel: string, message: any) {
    const msg = JSON.stringify(message);
    await this.pubclient.publish(channel, msg);
  }

  async subscribe(channel: string, callback: (msg: string) => void) {
    await this.subclient.subscribe(channel, callback);
  }

  static async getCurrentPrice(asset: string): Promise<{ bid: number; ask: number } | null> {
    try {
      const instance = await RedisManager.getInstance();
      
      // Get the latest price data from Redis
      const priceData = await instance.pubclient.get(`price:${asset}`);
      
      if (!priceData) {
        return null;
      }

      const parsed = JSON.parse(priceData);
      return {
        bid: parsed.bidPrice || 0,
        ask: parsed.askPrice || 0
      };
    } catch (error) {
      console.error(`Failed to get current price for ${asset}:`, error);
      return null;
    }
  }

  async disconnect() {
    await this.pubclient.quit();
    await this.subclient.quit();
  }
}