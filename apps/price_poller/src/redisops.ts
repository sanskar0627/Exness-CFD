//it formats and publishes that data into Redis channels
import { fromInternalPrice, toInternalPrice } from "./utils.js";
import { createClient, type RedisClientType } from "redis";
//standardizes symbol names all over the code
const symbolMap: { [key: string]: string } = { BTCUSDT: "BTC", ETHUSDT: "ETH", SOLUSDT: "SOL" 
};

export async function setupRedis() {
  try {
    //making connection to redis
    const redis = createClient({ url: "redis://localhost:6379" });
    await redis.connect();
    console.log("✅ Redis connected");
    
    redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
    });
    
    redis.on('disconnect', () => {
      console.warn('⚠️ Redis disconnected');
    });
    //this wil return redis object so other parts of the app can reuse this same instance
    return redis;
  } catch (error) {
    console.error('❌ Failed to setup Redis:', error);
    throw error; // Re-throw to stop the app if Redis fails
  }
}
//This function is where the actual live market data is sent to Redis.
export async function pushToRedis(redis: any, value: number, type: string, time: number): Promise<void> {
  try {
    //cheks the valid input the user want if no then return nothing and stops
    const symbol = symbolMap[type];
    if (!symbol) return;

    const realVal = fromInternalPrice(value);
    const ask = toInternalPrice(realVal * 1.01);    //sell price
    const bid = toInternalPrice(realVal);           //Price buy price
    
    // Debug logging to track price conversion
    if (symbol === "ETH" && Math.random() < 0.1) { // Log 10% of ETH prices
      console.log(`🔍 ETH Price Flow: input=${value} → realVal=$${realVal.toFixed(2)} → ask=${ask} bid=${bid}`);
    }
    
    const priceData = {
      symbol,
      askPrice: ask, 
      bidPrice: bid,  
      decimals: 4,
      time: Math.floor(new Date(time).getTime() / 1000),
    };

    // Store price data for quick retrieval (used by trading service)
    await redis.set(`price:${symbol}`, JSON.stringify(priceData), 'EX', 60); // Expire in 60 seconds

    // publish a message on the Redis channel named after symbol for live updates
    await redis.publish(symbol, JSON.stringify(priceData));
  } catch (error) {
    console.error(`❌ Failed to publish to Redis for ${type}:`, error);
    throw error; // Re-throw so caller can handle
  }
}
