import { createClient } from "redis";
import type { redisPriceData, IncomingredisPriceData } from "../types";
import { PriceDataSchema } from "../types";
import { SUPPORTED_ASSETS, Asset } from "shared";
const client = createClient({
  url: process.env.REDIS_URL,
});

export const PriceStorageMp = new Map<Asset, redisPriceData>();

export async function initPriceMonitor() {
  try {
    client.on("error", (err) => console.log("Redis Client Error", err));
    client.on("reconnecting", () => console.log("Reconnecting to Redis..."));
    if (!client.isOpen) {
      await client.connect();
      console.log("Redis Connected Sucessfully !!!!!!!!!");
    }
    for (const asset of SUPPORTED_ASSETS) {
      client.subscribe(asset, (mssg) => {
        const message = JSON.parse(mssg);
        const parsedata: redisPriceData = {
          bid: message.bidPrice, // Sell price in PRICE_SCALE
          ask: message.askPrice, // Buy price in PRICE_SCALE
          decimals: 4,
          time: message.time,
        };
        PriceStorageMp.set(asset, parsedata);
      });
    }
  } catch (err) {
    console.error("Error in Connecting Redish , Trying again in 3 second", err);
    setTimeout(() => {
      initPriceMonitor();
    }, 3000);
  }
}

export async function handelPriceUpdate(assert: Asset, message: string) {
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
    PriceStorageMp.set(assert, PriceData);
    console.log("Sucessfully Handels the Price Update!!");
  } catch (err) {
    console.error("Error In Updating the Price", err);
  }
}

export async function getCurrentPrice(assert: Asset) {
  const currentPrice = PriceStorageMp.get(assert);
  if (!currentPrice) {
    console.log(" NO  Data for this Assert");
    return null;
  }
  const time = Math.floor(Date.now() / 1000);;
  const time_Diff = time - currentPrice.time;
  if (time_Diff >= 10) {
    console.log("The price of the Asset is old it not a new price");
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
