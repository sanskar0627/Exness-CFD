import { fromInternalPrice, toInternalPrice } from "./utils.js";
import { createClient, type RedisClientType } from "redis";

const symbolMap: { [key: string]: string } = { 
  BTCUSDT: "BTC", 
  ETHUSDT: "ETH", 
  SOLUSDT: "SOL" 
};

export async function setupRedis() {
  try {
    const redis = createClient({ url: "redis://localhost:6379" });
    await redis.connect();
    console.log("✅ Redis connected");
    
    redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
    });
    
    redis.on('disconnect', () => {
      console.warn('⚠️ Redis disconnected');
    });
    
    return redis;
  } catch (error) {
    console.error('❌ Failed to setup Redis:', error);
    throw error; // Re-throw to stop the app if Redis fails
  }
}

export async function pushToRedis(
  redis: any, 
  value: number, 
  type: string, 
  time: number
): Promise<void> {
  try {
    const symbol = symbolMap[type];
    if (!symbol) return;

    const realVal = fromInternalPrice(value);
    const ask = toInternalPrice(realVal * 1.01);
    const bid = toInternalPrice(realVal);

    await redis.publish(
      symbol,
      JSON.stringify({
        symbol,
        askPrice: ask,
        bidPrice: bid,
        decimals: 4,
        time: Math.floor(new Date(time).getTime() / 1000),
      }),
    );
  } catch (error) {
    console.error(`❌ Failed to publish to Redis for ${type}:`, error);
    throw error; // Re-throw so caller can handle
  }
}
