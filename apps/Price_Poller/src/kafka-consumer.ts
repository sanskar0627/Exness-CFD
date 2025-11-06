import { Kafka } from "kafkajs";
import { writeBatch } from "./database";
import type { Trades } from "./binance";

// State variables
let batch: Trades[] = [];
let batchTimer: NodeJS.Timeout | null = null; // in node.js setimeout() return an  NodeJS.Timeout object  and browser return an number
let isShuttingDown = false;

const kafka = new Kafka({
  clientId: "exness_cfd_consumer",
  brokers: process.env.KAFKA_BROKERS?.split(",") || ["localhost:9092"],
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

const consumer = kafka.consumer({ groupId: "exness_consumer_group" }); //connect kakfka consumer

async function flushBatch() {
  if (batch.length === 0) return; //no trades in batch then do nothing.
  const currentBatch = [...batch];
  batch = [];

  try {
    await writeBatch(currentBatch);
    console.log(` Flushed ${currentBatch.length} trades to database`);
  } catch (error) {
    console.error(" Database write failed:", error);
  }
}

function resetBatchTimer() {
  if (batchTimer) {
    clearTimeout(batchTimer); // Clear existing setTimeout timer
  }

  // Start new timer that flushes after timeout
  batchTimer = setTimeout(async () => {
    console.log("Batch timeout 5 sec, flushing...");
    await flushBatch();
  }, 5000);
}

export async function consumer_gr() {
  if (isShuttingDown) return;

  try {
    await consumer.connect();
    console.log("Kafka consumer connected");

    await consumer.subscribe({
      topic: "trades",
      fromBeginning: false,
    });
    console.log(" Subscribed to 'trades' topic");

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          // Parse message
          const data = JSON.parse(message.value?.toString() ?? "{}");
          batch.push(data);

          // Check if batch size reached
          if (batch.length >= 1000) {
            console.log(` Batch size reached (${batch.length}), flushing...`);
            await flushBatch();

            // Clear and reset timer after manual flush
            if (batchTimer) {
              clearTimeout(batchTimer);
            }
            resetBatchTimer();
          } else {
            // Reset timer on every new message
            resetBatchTimer();
          }
        } catch (error) {
          console.error(" Error processing message:", error);
        }
      },
    });
  } catch (err) {
    console.error(" Kafka consumer error:", err);

    // Cleanup: disconnect consumer before retry
    try {
      if (consumer) {
        await consumer.disconnect();
        console.log("Consumer disconnected after error");
      }
    } catch (Err) {
      console.error("Error disconnecting consumer:", Err);
    }

    // Retry only if not shutting down
    if (!isShuttingDown) {
      setTimeout(() => {
        console.log("Reconnecting in 3 seconds...");
        consumer_gr();
      }, 3000);
    }
  }
}
////// Grace Shutdown!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
async function gracefulShutdown(signal: string) {
  isShuttingDown = true;
  console.log(`${signal} received: Starting graceful shutdown...`);

  try {
    // Stop the batch timer first (fixes Issue #4)
    if (batchTimer) {
      clearTimeout(batchTimer);
      console.log(" Batch timer stopped");
    }

    // Flush remaining batch before shutdown
    if (batch.length > 0) {
      console.log(`Flushing ${batch.length} remaining trades to database...`);
      await writeBatch(batch);
      batch = [];
      console.log(" Batch flushed successfully");
    }

    // Disconnect consumer
    if (consumer) {
      await consumer.disconnect();
      console.log(" Kafka consumer disconnected successfully");
    }

    console.log(" Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error(" Error during graceful shutdown:", error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
