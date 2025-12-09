import { Kafka, logLevel } from "kafkajs";
import { binanceEmitter } from "./binance";
import type { Trades } from "./binance"; //  Import Trades type from binance.ts

// Note: KafkaJS timeout warning suppression is handled in index.ts before imports

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
  logLevel: logLevel.NOTHING, // Suppress all Kafka logs - we handle errors in catch blocks
  connectionTimeout: 10000, // 10 seconds
  requestTimeout: 30000, // 30 seconds
  retry: {
    initialRetryTime: 300,
    retries: 10,
    maxRetryTime: 30000,
    multiplier: 2,
    restartOnFailure: async (e: any) => {
      // Only restart on network errors, not on fatal errors
      return e.retriable === true;
    },
  },
});

// CRITICAL FIX: Configure producer with explicit acks and timeout to prevent negative timeout bug
const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000, // 30 seconds
  // IMPORTANT: These settings prevent the negative timeout warning
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
}); // create producer instance

let tradeListener: ((tradeData: Trades) => Promise<void>) | null = null; //  Properly typed listener Store it to remove later and prevent memory leaks
let isShuttingDown = false;
let isConnected = false; // Track connection state

export async function kafkaproduce() {
  if (isShuttingDown || isConnected) return;

  // Wait for Kafka to be ready (5 second delay on first start)
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    //Connecting kafka producer
    console.log("Connecting to Kafka producer...");
    await producer.connect();
    isConnected = true;
    console.log("✓ Kafka Producer connected successfully");

    // Added this - Assign function to variable so we can remove it later
    tradeListener = async (tradeData: Trades) => {
      // Skip if shutting down or not connected
      if (isShuttingDown || !isConnected) return;

      try {
        const publishTrade: typeofPriceData = {
          symbol: tradeData.symbol,
          price: tradeData.price,
          tradeId: tradeData.tradeId,
          timestamp: tradeData.timestamp,
          quantity: tradeData.quantity,
        };
        // CRITICAL FIX: Add explicit timeout and acks to prevent negative timeout warning
        await producer.send({
          topic: "trades",
          timeout: 30000, // Explicit 30s timeout
          acks: 1, // Wait for leader acknowledgment only (not all replicas)
          compression: 1, // GZIP compression (optional performance boost)
          messages: [
            {
              key: tradeData.symbol,
              value: JSON.stringify(publishTrade),
              // Add explicit timestamp to message metadata (not just in payload)
              timestamp: String(Date.now()),
            },
          ],
        });
      } catch (error) {
        // Only log if it's a critical error
        if (error instanceof Error && !error.message.includes("retriable")) {
          console.error("Error processing kafka trade data:", error.message);
        }
      }
    };
    //getting the data from binance.ts ws emitter
    binanceEmitter.on("trade", tradeListener);
  } catch (err) {
    isConnected = false;
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`✗ Kafka producer connection failed: ${errorMessage}`);
    console.log("Retrying in 5 seconds...");

    //  Remove old listener before reconnecting to prevent duplicates
    if (tradeListener) {
      binanceEmitter.removeListener("trade", tradeListener);
      tradeListener = null;
    }

    if (!isShuttingDown) {
      setTimeout(() => {
        kafkaproduce();
      }, 5000);
    }
  }
}

// Export cleanup function for coordinated shutdown from main index.ts
export async function shutdownProducer() {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log("Shutting down Kafka producer...");

  try {
    // Remove event listener first to stop receiving new trades
    if (tradeListener) {
      binanceEmitter.removeListener("trade", tradeListener);
      tradeListener = null;
    }

    // Disconnect producer if connected
    if (isConnected) {
      await producer.disconnect();
      isConnected = false;
      console.log("✓ Kafka producer disconnected successfully");
    }
  } catch (error) {
    console.error("✗ Error during Kafka producer shutdown:", error);
  }
}
