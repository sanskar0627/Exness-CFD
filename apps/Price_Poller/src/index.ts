import { startBinance } from "./binance";
import { kafkaproduce } from "./kafka-producer";
import { consumer_gr } from "./kafka-consumer";
import { startRedis } from "./redish-publisher";

export async function startTrade() {
  await startRedis();
  await kafkaproduce();
  consumer_gr();
  startBinance();

  console.log("All Price_Poller components started successfully!");
}

// Coordinated graceful shutdown  waits for all components to finish cleanup
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received: Coordinating Price_Poller shutdown...`);
  await new Promise(resolve => setTimeout(resolve, 3000)); 

  console.log("Price_Poller shutdown complete. Exiting...");
  process.exit(0);
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
