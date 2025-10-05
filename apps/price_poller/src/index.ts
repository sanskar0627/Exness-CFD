import { WebSocket, WebSocketServer } from "ws";
import { toInternalPrice } from "./utils.js";
import { pushToRedis, setupRedis } from "./redisops.js";
import { saveTradeBatch } from "./dbops.js";

const BATCH_INTERVAL = 10000;
let tradeBatch: any[] = [];

async function main() {
  const redis = await setupRedis();

  // Every 10s, dump batch to DB
  const batchInterval = setInterval(async () => {
    try {
      const batch = [...tradeBatch];
      tradeBatch = [];
      await saveTradeBatch(batch);
    } catch (error) {
      console.error("❌ Failed to save trade batch:", error);
    }
  }, BATCH_INTERVAL);

  // Connect to Binance
  const ws = new WebSocket("wss://stream.binance.com:9443/ws");
  ws.on("open", () => {
    console.log("Connected to Binance Stream");
    ws.send(
      JSON.stringify({
        method: "SUBSCRIBE",
        params: ["btcusdt@aggTrade", "ethusdt@aggTrade", "solusdt@aggTrade"],
        id: 1,
      }),
    );
  });

  ws.on("message", async (data: any) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.e === "aggTrade") {
        const price = toInternalPrice(msg.p);
        const qty = toInternalPrice(msg.q);
        
        try {
          await pushToRedis(redis, price, msg.s, msg.T);
        } catch (redisError) {
          console.error("❌ Redis publish failed:", redisError);
          // Continue processing even if Redis fails
        }
        
        tradeBatch.push({
          symbol: msg.s,
          price,
          quantity: qty,
          tradeId: BigInt(msg.a),
          timestamp: new Date(msg.T),
        });
      }
    } catch (error) {
      console.error("❌ Failed to process Binance message:", error);
      console.error("Raw data:", data.toString());
    }
  });

  ws.on("error", (err: any) => console.error("❌ Binance error:", err));
  ws.on("close", () => {
    console.log("⚠️ Binance stream closed - attempting reconnect...");
    setTimeout(() => main(), 5000); // Reconnect after 5 seconds
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    clearInterval(batchInterval);
    
    // Save remaining batch
    if (tradeBatch.length > 0) {
      await saveTradeBatch(tradeBatch);
    }
    
    ws.close();
    await redis.disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
