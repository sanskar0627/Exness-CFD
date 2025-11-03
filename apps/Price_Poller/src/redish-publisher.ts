import { createClient } from "redis";
import { binanceEmitter } from "./binance";

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
}); //connect to the docker redis

interface typeofredishPriceData {
  // interface  to publish the data in redis
  symbol: string;
  askPrice: number;
  bidPrice: number;
  decimals: number;
  time: number;
}
export async function startRedis() {
  try {
    await redis.connect();
    console.log("Redis Connected Sucessfully !!!!!!!!!");
    //  getting the data from binance emitter
    binanceEmitter.on("trade", async (tradeData) => {
      try {
        const redisPriceData: typeofredishPriceData = {
          symbol: tradeData.symbol.replace("USDT", ""),
          askPrice: Math.round(tradeData.price * 1.005),
          bidPrice: Math.round(tradeData.price * 0.995),
          decimals: 4,
          time: Math.floor(tradeData.timestamp / 1000),
        };
        const channel = tradeData.symbol.replace("USDT", ""); // Something like "SOL " Btc"
        await redis.publish(channel, JSON.stringify(redisPriceData));
      } catch (err) {
        console.error("Error publishing trade:", err);
      }
    });
  } catch (err) {
    console.error("Error Connecting to Redis ", err);
    setTimeout(() => {
      startRedis();
    }, 3000);
  }
}
