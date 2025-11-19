import { WebSocketServer, WebSocket, RawData } from "ws";
import { createClient, RedisClientType } from "redis";
import { SUPPORTED_ASSETS, type Asset } from "shared";
import { SubscriptionManager } from "./subscription-manager";
import type { ClientMessage, ServerMessage, PriceUpdate } from "./types";

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});
const wss = new WebSocketServer({ port: 8080 });
const SubsManager = new SubscriptionManager();
let isShuttingDown = false;

export async function StartWs() {
  await connectRedis();
  await WS();
}

async function connectRedis() {
  try {
    await redis.connect();
    console.log("Redish Connect In WebSokcet !!!!!!!!!!!");
    for (const asset of SUPPORTED_ASSETS) {
      await redis.subscribe(asset, (mssg) => {
        handlePriceUpdate(asset, mssg);
      });
      console.log(`Subscribed to ${asset}`);
    }
  } catch (err) {
    console.error("Failed to Connect with redish Truing in 3 Sec");
    setTimeout(() => {
      connectRedis();
    }, 3000);
  }
}

async function WS() {
  try {
    //connect to the client from the susbcribing-manager fucntion
    wss.on("connection", function connection(ws) {
      SubsManager.addClient(ws);
      console.log("Client Connected");
      // on message from client
      ws.on("message", (mmsgg) => {
        handleClientMessage(ws, mmsgg);
      });
      ws.on("close", () => {
        SubsManager.removeClient(ws);
        console.log("Client DiSconnect Sucessfully !!!");
      });
      ws.on("error", (err) => {
        console.error("Error Occurred in WebSocket", err);
      });
    });
    console.log("Websocket is listening on port 8080 Readyyyyy");
  } catch (err) {
    console.error("Error setting up WebSocket server:", err);
  }
}

function handlePriceUpdate(asset: Asset, mssg: string) {
  try {
    const newData = JSON.parse(mssg);
    const PriceChange: PriceUpdate = {
      symbol: newData.symbol,
      bidPrice: newData.bidPrice,
      askPrice: newData.askPrice,
      decimals: newData.decimals,
      time: newData.time,
    };
    let response: ServerMessage = {
      type: "PRICE_UPDATE",
      data: PriceChange,
    };
    SubsManager.broadcast(asset, response);
  } catch (err) {
    console.error("Can't Able to Update Price", err);
  }
}

function handleClientMessage(ws: WebSocket, mssg: RawData) {
  try {
    let message = JSON.parse(mssg.toString());
    if (message.type === "SUBSCRIBE") {
      SubsManager.subscribeClient(ws, message.symbol);
      let response: ServerMessage = {
        type: "SUBSCRIBED",
        symbol: message.symbol,
      };
      ws.send(JSON.stringify(response));
    } else if (message.type === "UNSUBSCRIBE") {
      SubsManager.unsubscribeClient(ws, message.symbol);
      let response: ServerMessage = {
        type: "UNSUBSCRIBED",
        symbol: message.symbol,
      };
      ws.send(JSON.stringify(response));
    } else if (message.type === "PING") {
      ws.send(JSON.stringify({ type: "PONG" }));
    }
    ///for the  Error and wrong types this will throw error
    else {
      ws.send(
        JSON.stringify({ type: "ERROR", message: "Unknown message type" }),
      );
    }
  } catch (err) {
    console.error("Error parsing message:", err);
  }
}

// Graceful shutdown function
async function gracefulShutdown() {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\nShutting down WebSocket server gracefully...");

  // Close all connected client WebSockets
  wss.clients.forEach((client) => {
    client.close(1000, "Server shutting down");
  });

  // Close the WebSocket server
  wss.close(() => {
    console.log("WebSocket server closed");
  });

  // Disconnect from Redis
  await redis.disconnect();
  console.log("Redis disconnected");

  console.log("Graceful shutdown complete");
  process.exit(0);
}

// Register shutdown handlers for SIGTERM (kill) and SIGINT (Ctrl+C)
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
