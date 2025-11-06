import { Kafka } from "kafkajs";
import { binanceEmitter } from "./binance";
import type { Trades } from "./binance"; //  Import Trades type from binance.ts

interface typeofPriceData {
  // interface  to publish the data in kafka
  symbol: string;
  price: number;
  tradeId: number;
  timestamp: number;
  quantity: string;
}
//connecting it with Docker
const kafka = new Kafka({
  clientId: "exness_cfd_producer",
  brokers: process.env.KAFKA_BROKERS?.split(",") || ["localhost:9092"],
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

const producer = kafka.producer(); // create producer instance

let tradeListener: ((tradeData: Trades) => Promise<void>) | null = null; //  Properly typed listener Store it to remove later and prevent memory leaks
let isShuttingDown = false;

export async function kafkaproduce() {
  if (isShuttingDown) return;
  try {
    //Connceting kafka producer
    await producer.connect();
    console.log("Kafka Publisher Connected Sucessfully!!!!!!!");

    // Added this - Assign function to variable so we can remove it later
    tradeListener = async (tradeData: Trades) => {
      try {
        const publishTrade: typeofPriceData = {
          symbol: tradeData.symbol,
          price: tradeData.price,
          tradeId: tradeData.tradeId,
          timestamp: tradeData.timestamp,
          quantity: tradeData.quantity,
        };
        await producer.send({
          topic: "trades",
          messages: [
            {
              key: tradeData.symbol,
              value: JSON.stringify(publishTrade),
            },
          ],
        });
      } catch (error) { 
        console.error("Error processing kafka trade data:", error);
      }
    };
    //getting the data from binace.ts ws emiiter{functioon call heppening}
    binanceEmitter.on("trade", tradeListener);
  } catch (err) {
    console.error(
      "problem in connecting with kafka retrying in 3 seconds",
      err
    );
    //  Remove old listener before reconnecting to prevent duplicates
    if (tradeListener) {
      binanceEmitter.removeListener("trade", tradeListener);
    }

    if (!isShuttingDown) {
      setTimeout(() => {
        kafkaproduce();
      }, 3000);
    }
  }
}

async function gracefulShutdown(signal: string) {  // signal is a string like "SIGTERM", "SIGINT" basically the type :signal
  isShuttingDown = true;
  console.log(`${signal} received: Starting graceful shutdown...`);
  try {
    if (tradeListener) {
      binanceEmitter.removeListener("trade", tradeListener);
    }

    await producer.disconnect();
    console.log("Kafka producer disconnected successfully");
  } catch (error) {
    console.error("Error during Kafka producer shutdown:", error);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled Promise Rejection:", reason);
  await gracefulShutdown("UNHANDLED_REJECTION");
});
