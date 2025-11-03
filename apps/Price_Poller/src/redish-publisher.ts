import { createClient } from "redis";
import { binanceEmitter } from "./binance";
import type { Trades } from "./binance";

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

let tradeListener: ((tradeData: Trades) => Promise<void>) | null = null;
let isShuttingDown = false;

export async function startRedis() {
  try {
    await redis.connect();
    console.log("Redis Connected Sucessfully !!!!!!!!!");

    //  getting the data from binance emitter
    tradeListener = async (tradeData: Trades) => {
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
    };

    binanceEmitter.on("trade", tradeListener);
  } catch (err) {
    console.error("Error Connecting to Redis ", err);

    if (tradeListener) {
      binanceEmitter.removeListener("trade", tradeListener);
    }

    if (!isShuttingDown) {
      setTimeout(() => {
        startRedis();
      }, 3000);
    }
  }
}

async function gracefulShutdown(signal: string) {
  isShuttingDown = true;
  console.log(`${signal} received: Shutting down Redis publisher...`);

  try {
    if (tradeListener) {
      binanceEmitter.removeListener("trade", tradeListener);
    }

    if (redis.isOpen) {
      await redis.quit();
      console.log("Redis disconnected successfully");
    }
  } catch (error) {
    console.error("Error during Redis shutdown:", error);
    if (redis.isOpen) {
      await redis.disconnect();
    }
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
