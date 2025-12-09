import { Kafka, logLevel } from "kafkajs";
import { writeBatch } from "./database";
import type { Trades } from "./binance";

// Note: KafkaJS timeout warning suppression is handled in index.ts before imports

// State variables
let batch: Trades[] = [];
let batchTimer: NodeJS.Timeout | null = null; // in node.js setimeout() return an  NodeJS.Timeout object  and browser return an number
let isShuttingDown = false;
let isConnected = false; // Track connection state

const kafka = new Kafka({
  clientId: "exness_cfd_consumer",
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

// CRITICAL FIX: Configure consumer with proper timeouts to prevent negative timeout bug
const consumer = kafka.consumer({
  groupId: "exness_consumer_group",
  sessionTimeout: 60000, // Increased to 60s
  heartbeatInterval: 3000, // Explicitly set to 3s
  // IMPORTANT: These settings prevent timeout calculation errors
  maxWaitTimeInMs: 5000, // Max wait time for fetch requests
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
}); //connect kafka consumer

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
  if (isShuttingDown || isConnected) return;

  // Wait for Kafka to be ready (6 second delay - slightly after producer)
  await new Promise(resolve => setTimeout(resolve, 6000));

  try {
    console.log("Connecting to Kafka consumer...");
    await consumer.connect();
    isConnected = true;
    console.log("✓ Kafka Consumer connected successfully");

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
          if (batch.length >= 500) {
            console.log(`Batch size reached (${batch.length}), flushing...`);
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
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Error processing message: ${errorMessage}`);
        }
      },
    });
  } catch (err) {
    isConnected = false;
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`✗ Kafka consumer connection failed: ${errorMessage}`);
    console.log("Retrying in 5 seconds...");

    // Cleanup: disconnect consumer before retry
    try {
      if (consumer) {
        await consumer.disconnect();
      }
    } catch (disconnectErr) {
      // Silently handle disconnect errors during retry
    }

    // Retry only if not shutting down
    if (!isShuttingDown) {
      setTimeout(() => {
        consumer_gr();
      }, 5000);
    }
  }
}
// Export cleanup function for coordinated shutdown from main index.ts
export async function shutdownConsumer() {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log("Shutting down Kafka consumer...");

  try {
    // Stop the batch timer first
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
      console.log("✓ Batch timer stopped");
    }

    // Flush remaining batch before shutdown
    if (batch.length > 0) {
      console.log(`  Flushing ${batch.length} remaining trades to database...`);
      await writeBatch(batch);
      batch = [];
      console.log("✓ Batch flushed successfully");
    }

    // Disconnect consumer if connected
    if (isConnected && consumer) {
      await consumer.disconnect();
      isConnected = false;
      console.log("✓ Kafka consumer disconnected successfully");
    }
  } catch (error) {
    console.error("✗ Error during Kafka consumer shutdown:", error);
  }
}
