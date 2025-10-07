import { createClient } from 'redis';

// Since we removed the Trade table and now use Redis for price data,
// this function now saves price data to Redis instead of database
export async function saveTradeBatch(trades: any[]) {
  // if nothing to insert.
  if (!trades.length) return;
  
  try {
    const redis = createClient({ url: 'redis://localhost:6379' });
    await redis.connect();
    
    let savedCount = 0;
    
    for (const trade of trades) {
      // Save price data to Redis with proper key structure
      const priceData = {
        bidPrice: trade.price,
        askPrice: trade.price + 1, // Small spread for simulation
        timestamp: trade.timestamp
      };
      
      await redis.set(`price:${trade.symbol}`, JSON.stringify(priceData));
      await redis.publish(trade.symbol, JSON.stringify(priceData));
      savedCount++;
    }
    
    await redis.disconnect();
    console.log(`Saved ${savedCount} trades to Redis`);
  } catch (e) {
    console.error("Redis batch save error:", e);
  }
}
