import { createClient } from "redis";
import type { redisPriceData, IncomingredisPriceData } from "../types";
import { PriceDataSchema, STALE_PRICE_THRESHOLD_MS } from "../types";
import { SUPPORTED_ASSETS, Asset } from "shared";
const client = createClient({
  url: process.env.REDIS_URL,
});

import { PriceStorageMp } from "../data/store";

let redisRetryCount = 0;
const MAX_REDIS_RETRIES = 10;

export async function initPriceMonitor() {
  try {
    //  Remove existing listeners to prevent memory leak on retries
    client.removeAllListeners("error");
    client.removeAllListeners("reconnecting");
    
    client.on("error", (err) => console.log("Redis Client Error", err));
    client.on("reconnecting", () => console.log("Reconnecting to Redis..."));
    if (!client.isOpen) {
      await client.connect();
      console.log("Redis Connected Sucessfully !!!!!!!!!");
      redisRetryCount = 0; // Reset retry count on successful connection
    }
    for (const asset of SUPPORTED_ASSETS) {
      client.subscribe(asset, (mssg) => {
        //  Wrap JSON.parse in try-catch to prevent subscription crash
        try {
          const message = JSON.parse(mssg);
          const parsedata: redisPriceData = {
            bid: message.bidPrice, // Sell price in PRICE_SCALE
            ask: message.askPrice, // Buy price in PRICE_SCALE
            decimals: 4,
            time: message.time,
          };
          PriceStorageMp.set(asset, parsedata);
        } catch (parseErr) {
          console.error(`[REDIS] Failed to parse message for ${asset}:`, parseErr);
        }
      });
    }
  } catch (err) {
    redisRetryCount++;
    if (redisRetryCount >= MAX_REDIS_RETRIES) {
      console.error(`[REDIS] Max retries (${MAX_REDIS_RETRIES}) reached. Giving up.`);
      return;
    }
    // Exponential backoff 1s, 2s, 4s, 8s, 16s, 30s (capped)
    const backoffDelay = Math.min(1000 * Math.pow(2, redisRetryCount - 1), 30000);
    console.error(`[REDIS] Error connecting (attempt ${redisRetryCount}/${MAX_REDIS_RETRIES}), retrying in ${backoffDelay/1000}s...`, err);
    setTimeout(() => {
      initPriceMonitor();
    }, backoffDelay);
  }
}

export async function handlePriceUpdate(asset: Asset, message: string) {
  try {
    const messages: IncomingredisPriceData = JSON.parse(message);
    const validdate = PriceDataSchema.safeParse(messages);
    if (!validdate.success) {
      console.log("All the  values are not present");
      return;
    }
    const PriceData: redisPriceData = {
      bid: messages.bidPrice,
      ask: messages.askPrice, // Buy price in PRICE_SCALE
      decimals: 4,
      time: messages.time,
    };
    PriceStorageMp.set(asset, PriceData);
    console.log("Successfully handled the price update");
  } catch (err) {
    console.error("Error In Updating the Price", err);
  }
}

export async function getCurrentPrice(asset: Asset) {
  const currentPrice = PriceStorageMp.get(asset);
  if (!currentPrice || !currentPrice.time) {
    console.log(" NO  Data for this Asset or Time is missing");
    return null;
  }
  // Check if price is stale using milliseconds
  const priceAge = Date.now() - currentPrice.time;
  if (priceAge >= STALE_PRICE_THRESHOLD_MS) {
    console.log(`The price of the Asset is old (${(priceAge/1000).toFixed(1)}s old, threshold: ${STALE_PRICE_THRESHOLD_MS/1000}s)`);
    return null;
  }
  const returnPrice: IncomingredisPriceData = {
    bidPrice: currentPrice.bid, // Sell price in PRICE_SCALE
    askPrice: currentPrice.ask, // Buy price in PRICE_SCALE
    time: currentPrice.time,
  };
  return returnPrice;
}

export async function stopPriceMonitor() {
  try {
    //  Unsubscribe from all channels
    for (const asset of SUPPORTED_ASSETS) {
      await client.unsubscribe(asset);
    }
    console.log("Unsubscribed from all price channels");

    
    if (client.isOpen) {
      await client.quit();
      console.log("Redis connection closed successfully");
    }

    
    PriceStorageMp.clear();
    console.log("Price storage cleared");
  } catch (err) {
    console.error("Error stopping price monitor:", err);
    // Force disconnect if quit fails
    if (client.isOpen) {
      await client.disconnect();
    }
  }
}
