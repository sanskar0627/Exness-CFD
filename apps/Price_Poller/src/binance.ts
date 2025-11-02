import { BINANCE_STREAMS } from "shared";
import { WebSocket } from "ws";

function start() {
  try {
    const wss = new WebSocket("wss://stream.binance.com:9443"); //connecting to binance

    //ON opening of Websocket
    wss.on("open", () => {
      console.log("WebSocket connection is open.");
      //creating an subascription message to get the streams from binance
      const stream = {
        method: "SUBSCRIBE",
        params: Object.values(BINANCE_STREAMS),
        id: 1,
      };
      //sending subscription
      wss.send(JSON.stringify(stream));

      // Data Coming from Binance
      wss.on("message", (data: any) => {
        const message_ws = JSON.parse(data.toString());
        if (message_ws.e == "aggTrade") {
        }
      });

      //if the websocket Get Closed
      wss.on("close", () => {
        console.log("Websocket conncetion is closed");
        //logic of reconnecting to the websocket after evry 3 seconds
        setTimeout(() => {
          start();
        }, 3000);
      });

      wss.on("error", (err) => {
        console.error("WebSocket error:", err);
        setTimeout(() => {
          ////Again Restarting it in 3 seconds
          start();
        }, 3000);
      });
    });
  } catch (err) {
    console.error(err);
    setTimeout(() => {
      ////logic of reconnecting to the websocket after evry 3 seconds
      start();
    }, 3000);
  }
}

//  Current Status: ~60% Complete ❌

//   ✅ What's Already Implemented:

//   1. ✅ Connection to Binance WebSocket - Working correctly
//   2. ✅ Subscription to BTC, ETH, SOL streams - Using BINANCE_STREAMS properly
//   3. ✅ Connection opening - Handles 'open' event
//   4. ✅ Error handling - Has error listener
//   5. ✅ Reconnection logic - Reconnects every 3 seconds on close/error

//   ❌ What's Missing:

//   1. ❌ No Trade Data Parsing (line 22-23)
//     - You check if (message_ws.e == "aggTrade") but don't extract any data
//     - Missing: symbol, price, quantity, tradeId, timestamp extraction
//   2. ❌ No Event Emission
//     - No way for other modules (Kafka producer, database, Redis) to receive trade data
//     - Need to export an EventEmitter or use callbacks
//   3. ❌ No Type Definitions
//     - No TypeScript interface for Binance trade messages
//     - Using any type (line 20)
//   4. ❌ Not Exported
//     - The start() function isn't exported, so index.ts can't use it
//   5. ❌ No Price Conversion
//     - Should use toInternalPrice() from shared package to convert prices

//   🐛 Issues Found:

//   1. Line 20: Using any type - should have proper Binance message type
//   2. Line 22: Event listeners inside message handler will create duplicates
//   3. Line 25-38: Event listeners for 'close' and 'error' should be outside the 'message'
//   handler

//   💡 What You Should Add:

//   Here's what the complete implementation should include:

//   import { BINANCE_STREAMS, toInternalPrice } from "shared";
//   import { WebSocket } from "ws";
//   import { EventEmitter } from "events";

//   // TypeScript interface for Binance aggTrade message
//   interface BinanceAggTrade {
//     e: "aggTrade";           // Event type
//     E: number;               // Event time
//     s: string;               // Symbol (BTCUSDT, ETHUSDT, SOLUSDT)
//     a: number;               // Aggregate trade ID
//     p: string;               // Price
//     q: string;               // Quantity
//     f: number;               // First trade ID
//     l: number;               // Last trade ID
//     T: number;               // Trade time
//     m: boolean;              // Is buyer the market maker?
//   }

//   // Trade data to emit
//   export interface TradeData {
//     symbol: string;          // BTC, ETH, SOL (without USDT)
//     price: number;           // Internal price representation
//     tradeId: number;         // Binance trade ID
//     quantity: string;        // Trade quantity
//     timestamp: Date;         // Trade timestamp
//   }

//   export class BinanceClient extends EventEmitter {
//     // Implementation with proper event emission
//   }

//   Recommended Structure:
//   1. Use EventEmitter class to emit 'trade' events
//   2. Parse Binance message and extract: symbol, price, tradeId, quantity, timestamp
//   3. Convert price using toInternalPrice()
//   4. Strip 'USDT' from symbol (BTCUSDT → BTC)
//   5. Emit TradeData for Kafka/Database/Redis to consume
//   6. Export the class/function properly
