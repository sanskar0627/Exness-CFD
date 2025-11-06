import { BINANCE_STREAMS, toInternalPrice } from "shared";
import { WebSocket } from "ws";
import { EventEmitter } from "events"; // build in function to emit things across the code

export interface Trades {
  tradeId: number;
  symbol: string;
  price: number;
  quantity: string;
  timestamp: number;
}
// Export the event emitter so other modules can listen
export const binanceEmitter = new EventEmitter();
let wss: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isShuttingDown = false;

export  function startBinance() {
  if (isShuttingDown) return;
  try {
    wss = new WebSocket("wss://stream.binance.com:9443"); //connecting to binance
    //ON opening of Websocket
    wss.on("open", () => {
      console.log(" Binance WebSocket is Connected");
      //creating an subascription message to get the streams from binance
      const stream = {
        method: "SUBSCRIBE",
        params: Object.values(BINANCE_STREAMS),
        id: 1,
      };
      //sending subscription
      wss?.send(JSON.stringify(stream));
    });
    // Data Coming from Binance
    wss.on("message", (data: Buffer) => {
      try {
        //Buffer :Temporary storage of raw binary data
        const message_ws = JSON.parse(data.toString());
        if (message_ws.e == "aggTrade") {
          let liveTrades: Trades = {
            tradeId: message_ws.a,
            symbol: message_ws.s,
            price: toInternalPrice(message_ws.p),
            quantity: message_ws.q,
            timestamp: message_ws.T,
          };
          /////////EMit the trade  Data
          binanceEmitter.emit("trade", liveTrades);
        }
      } catch (err) {
        console.error("Error in Emitting data in Binance webscoket", err);
      }
    });
    // when websocket is clsoing
    wss.on("close", () => {
      if (isShuttingDown) return;
      console.log("Websocket conncetion is closed");
      //logic of reconnecting to the websocket after evry 3 seconds
      reconnectTimeout = setTimeout(() => {
        console.log("Attempting to reconnect...");
        startBinance();
      }, 3000);
    });
    wss.on("error", (err) => {
      console.error("WebSocket error:", err);
      // Close the connection to trigger reconnect
      wss?.close();
    });
  } catch (err) {
    console.error(" Fatal error in startBinance webscoket:", err);
    if (!isShuttingDown) {
      reconnectTimeout = setTimeout(() => {
        console.log("Attempting to reconnect...");
        startBinance();
      }, 3000);
    }
  }
}

async function gracefulShutdown(signal: string) {
  isShuttingDown = true;
  console.log(`${signal} received: Shutting down Binance WebSocket...`);

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (wss) {
    wss.close();
    wss = null;
  }

  console.log("Binance WebSocket stopped");
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
