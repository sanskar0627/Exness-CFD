// CRITICAL FIX: Suppress KafkaJS negative timeout warning (known Bun + KafkaJS compatibility issue)
// Must be at the very top before any imports to catch all warnings
// This is a non-fatal warning - KafkaJS automatically clamps negative timeouts to 1ms

// Simple line-by-line stderr filtering
const originalStderrWrite = process.stderr.write.bind(process.stderr);
let suppressNextStderrLines = 0;

process.stderr.write = function (chunk: any, ...args: any[]): boolean {
  const text = chunk.toString();

  // Check if this line contains the KafkaJS warning
  if (
    text.includes('TimeoutNegativeWarning') ||
    text.includes('is a negative number') ||
    text.includes('Timeout duration was set to 1')
  ) {
    // Start suppressing this line and the next 10 lines (the stack trace)
    suppressNextStderrLines = 11;
    return true; // Pretend we wrote it successfully
  }

  // Check if this line is part of the KafkaJS stack trace
  if (
    suppressNextStderrLines > 0 &&
    (text.trim().startsWith('at ') ||
     text.includes('kafkajs') ||
     text.includes('requestQueue') ||
     text.includes('node:') ||
     text.trim() === '')
  ) {
    suppressNextStderrLines--;
    return true; // Suppress this line
  }

  // Not a KafkaJS warning line - reset counter and write normally
  if (suppressNextStderrLines > 0 && !text.trim().startsWith('at ')) {
    // This line doesn't look like part of the stack trace, reset
    suppressNextStderrLines = 0;
  }

  // Pass through all other output
  return originalStderrWrite(chunk, ...args);
};

// Also intercept console.warn as backup
const originalWarn = console.warn;
console.warn = function (...args: any[]) {
  const message = args.join(' ');

  if (
    message.includes('TimeoutNegativeWarning') ||
    message.includes('is a negative number') ||
    message.includes('Timeout duration was set to 1')
  ) {
    return; // Suppress
  }

  originalWarn.apply(console, args);
};

import { startBinance } from "./binance";
import { kafkaproduce, shutdownProducer } from "./kafka-producer";
import { consumer_gr, shutdownConsumer } from "./kafka-consumer";
import { startRedis } from "./redish-publisher";

export async function startTrade() {
  console.log("═══════════════════════════════════════");
  console.log("  Starting Price_Poller Service");
  console.log("═══════════════════════════════════════");

  console.log("\n[1/4] Initializing Redis Publisher...");
  await startRedis();

  console.log("\n[2/4] Initializing Kafka Producer...");
  kafkaproduce(); // Non-blocking, will connect after delay

  console.log("\n[3/4] Initializing Kafka Consumer...");
  consumer_gr(); // Non-blocking, will connect after delay

  console.log("\n[4/4] Connecting to Binance WebSocket...");
  startBinance();

  console.log("\n✓ All Price_Poller components initialized!");
  console.log("═══════════════════════════════════════\n");
}

// Coordinated graceful shutdown - waits for all components to finish cleanup
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received: Coordinating Price_Poller shutdown...`);

  try {
    // Shutdown in reverse order of startup
    console.log("\n[1/3] Shutting down Kafka Consumer...");
    await shutdownConsumer();

    console.log("\n[2/3] Shutting down Kafka Producer...");
    await shutdownProducer();

    console.log("\n[3/3] Shutting down remaining components...");
    // Redis and Binance will handle their own cleanup via their signal handlers

    console.log("\n✓ Price_Poller shutdown complete. Exiting...");
    process.exit(0);
  } catch (error) {
    console.error("\n✗ Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start the Price_Poller when this file is executed
startTrade();
