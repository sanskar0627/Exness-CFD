import { createClient } from 'redis';

// Since we removed the Trade table and now use Redis for price data,
// this function now saves price data to Redis instead of database
export async function saveTradeBatch(trades: any[]) {
  // if nothing to insert.
  if (!trades.length) return;
  
  try {
    // This function is now just for logging/metrics purposes
    // The actual price publishing is done by redisops.ts to avoid conflicts
    console.log(`Processed ${trades.length} trades (prices published via redisops)`);
  } catch (e) {
    console.error("Trade batch processing error:", e);
  }
}
