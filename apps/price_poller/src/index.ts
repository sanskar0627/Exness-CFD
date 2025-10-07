import { WebSocket, WebSocketServer } from "ws";
import { toInternalPrice } from "./utils.js";
import { pushToRedis, setupRedis } from "./redisops.js";
import { saveTradeBatch } from "./dbops.js";

const BATCH_INTERVAL = 10000; //10 sec
let tradeBatch: any[] = []; //y array where incoming trades are stored until the next batch save

async function main() {
  const redis = await setupRedis(); //connecting redis

  // Every 10s, dump batch to DB
  const batchInterval = setInterval(async () => {
    try {
      const batch = [...tradeBatch]; // putting eveything in batch
      tradeBatch = []; //emptying it
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
        params: ["btcusdt@aggTrade", "ethusdt@aggTrade", "solusdt@aggTrade"], // subscribe to three streams: btc , eth , sol
        id: 1,
      })
    );
  });

  ws.on("message", async (data: any) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.e === "aggTrade") {    // checking the event type is that string or not  just to ignore non-trade messages.
        // only process "aggregate trade" events
        const price = toInternalPrice(msg.p);   //msg.p (price)
        const qty = toInternalPrice(msg.q);        //ssmg.1 (quantity)

        try {
          await pushToRedis(redis, price, msg.s, msg.T);
        } catch (redisError) {
          console.error("❌ Redis publish failed:", redisError);
          // Continue processing even if Redis fails
        }
        // after pushing to redish pushing the sma edata to trdae batch to store in db 
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
      console.error("Raw data:", data.toString()); // raw message to debug later 
    }
  });

  ws.on("error", (err: any) => console.error("❌ Binance error:", err));
  ws.on("close", () => {
    console.log("⚠️ Binance stream closed - attempting reconnect...");
    setTimeout(() => main(), 5000); // calling main function  Reconnect after 5 seconds
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("🛑 Shutting down gracefully...");
    clearInterval(batchInterval);

    // Save remaining batch
    if (tradeBatch.length > 0) {
      await saveTradeBatch(tradeBatch);
    }

    ws.close();
    await redis.quit();
    process.exit(0);
  });
}

main().catch(console.error);
