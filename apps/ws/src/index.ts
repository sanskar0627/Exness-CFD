import { createClient } from "redis";
import { WebSocket, WebSocketServer } from "ws";

//The url points to redis instance running the same docker network
const redis = createClient({ url: "redis://localhost:6379" }); // this is for docker to run locally redish basically

//starting websocket on port8080
const websocket = new WebSocketServer({ port: 8080 });

//Key is websocket connection and value is the price of BTC, ETH, SOL and all, helps to get which client wants which price
const client = new Map<WebSocket, Set<string>>();//To make a new one, you write new Map()

//The number of coins we will publish for now, in real app this comes from database
export const Channels = ["SOL", "ETH", "BTC"];

const start = async () => {
  try {
    await redis.connect(); //connecting redis
    console.log("Connected to Redis successfully");

    //whenever the price of coins will change then this callback function will call
    Channels.forEach((ch) => {
      redis.subscribe(ch, (data: string) => {
        try {
          client.forEach((symbs, ws: WebSocket) => {
            //if the client has subscribed to current symbol, forward the redis message to that client
            if (symbs.has(ch) && ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(data);
              } catch (sendError) {
                console.error(`❌ Failed to send to client:`, sendError);
                // Remove dead connection
                client.delete(ws);
              }
            }
          });
        } catch (error) {
          console.error(`❌ Error processing Redis message for ${ch}:`, error);
        }
      });
    });
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    process.exit(1);
  }
};

// Handle new WebSocket connections from browsers or trading bots.

websocket.on("connection", (ws: WebSocket) => {
  //start with empty subscription set
  client.set(ws, new Set());
  console.log("New WebSocket connection established");

  // checking which message is coming from client for which symbol he wants or he wants to subscribe or unsubscribe
  ws.on("message", (msg: any) => {
    try {
      const message = JSON.parse(msg.toString());

      //subscribe as client wants to receive the symbol price update
      if (message.type === "SUBSCRIBE") {
        //again making sure that map has a websocket entry
        if (!client.has(ws)) {
          client.set(ws, new Set());
        }
        const symbs = client.get(ws);
        if (Channels.includes(message.symbol)) {
          symbs?.add(message.symbol);
          console.log(`Client subscribed to ${message.symbol}`);
        } else {
          ws.send(JSON.stringify({ error: "Invalid symbol" }));
        }
      }
      // client asks to stop the symbol price ie :- unsubscribe
      else if (message.type === "UNSUBSCRIBE") {
        const symbs = client.get(ws);
        symbs?.delete(message.symbol);
        console.log(`Client unsubscribed from ${message.symbol}`);

        //if the client has no subscription left then remove it completely to save the memory
        if (symbs?.size === 0) {
          client.delete(ws);
        }
      }
    } catch (error) {
      console.error("Error parsing message:", error);
      ws.send(JSON.stringify({ error: "Invalid message format" }));
    }
  });

  // Handle WebSocket connection close
  ws.on("close", () => {
    console.log("WebSocket connection closed");
    client.delete(ws);
  });

  // Handle WebSocket errors
  ws.on("error", (error: any) => {
    console.error("WebSocket error:", error);
    client.delete(ws);
  });
});

start().catch(console.error);
