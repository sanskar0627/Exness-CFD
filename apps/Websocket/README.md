# 🔌 WebSocket Server

> Real-time price streaming service for cryptocurrency trading platform

---

## 🎯 What Is This?

A **WebSocket server** that delivers live cryptocurrency prices to users in real-time. When a user opens your trading app, this service ensures they see up-to-the-second prices for BTC, ETH, and SOL without refreshing the page.

---

## 🤔 Why Do We Need This?

**The Problem:**

- Traditional REST APIs require constant polling (refreshing every second)
- Polling is slow, wasteful, and creates server load
- Users need instant price updates for trading decisions

**The Solution:**

- WebSocket maintains a persistent connection
- Server **pushes** updates the moment they arrive
- Efficient: One connection serves unlimited updates
- Real-time: Sub-millisecond latency

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     TRADING PLATFORM                          │
└──────────────────────────────────────────────────────────────┘

        ┌─────────────────────────────────────────┐
        │         1. PRICE POLLER SERVICE         │
        │   (Fetches from Binance every second)   │
        └──────────────────┬──────────────────────┘
                          │
                          │ Publishes price updates
                          ↓
        ┌─────────────────────────────────────────┐
        │         2. REDIS PUB/SUB SYSTEM         │
        │      (Message broker/distributor)       │
        │   Channels: BTC | ETH | SOL             │
        └──────────────────┬──────────────────────┘
                          │
                          │ Subscribes to channels
                          ↓
        ┌─────────────────────────────────────────┐
        │      3. WEBSOCKET SERVER (THIS!)        │
        │     Manages client subscriptions        │
        │      Port: 8080 (ws://localhost)        │
        └──────────────────┬──────────────────────┘
                          │
                          │ Broadcasts to subscribers
                          ↓
        ┌─────────────────────────────────────────┐
        │      4. CONNECTED CLIENTS (Users)       │
        │   Frontend apps, mobile apps, etc.      │
        └─────────────────────────────────────────┘
```

---

## 🔄 How It Works (Step-by-Step)

### **Startup Phase**

1. Server starts on port 8080
2. Connects to Redis
3. Subscribes to BTC, ETH, SOL channels
4. Waits for clients to connect

### **Client Connection Phase**

1. User opens trading app
2. Frontend establishes WebSocket connection
3. Server creates unique ID for this client
4. Client subscribes to assets they want (e.g., "I want BTC prices")

### **Real-Time Update Phase**

1. Price Poller gets new BTC price from Binance → $65,234.56
2. Publishes to Redis channel "BTC"
3. WebSocket server receives update from Redis
4. Checks: "Who's subscribed to BTC?" → Finds 47 clients
5. Broadcasts update to those 47 clients only (not everyone!)
6. Frontend updates price display instantly

### **Disconnection Phase**

1. User closes app
2. WebSocket connection closes
3. Server removes client from all subscriptions
4. Memory cleaned up automatically

---

## 🧩 Key Components

### **1. WebSocket Server** (`websocket-server.ts`)

- **Job:** Main orchestrator
- **Handles:** Client connections, Redis messages, routing
- **Special:** Auto-reconnects to Redis if connection drops

### **2. Subscription Manager** (`subscription-manager.ts`)

- **Job:** Tracks who wants what
- **Stores:**
  - All connected clients (with UUIDs)
  - Each client's subscriptions (BTC? ETH? Both?)
  - Each asset's subscribers (Who wants BTC updates?)
- **Special:** Efficient lookup using Maps (instant access)

### **3. Message Types** (`types.ts`)

- **Client Messages:** Subscribe, Unsubscribe, Ping
- **Server Messages:** Price updates, Confirmations, Errors
- **Data:** Bid/Ask prices, timestamps, asset symbols

---

## 💡 Smart Design Decisions

### **Why Redis Pub/Sub?**

- **Decouples services:** Price Poller and WebSocket don't talk directly
- **Scalability:** Can run multiple WebSocket servers, all receive same data
- **Reliability:** If WebSocket crashes, prices keep flowing to Redis

### **Why Subscription System?**

- **Efficiency:** Don't send ETH updates to BTC-only watchers
- **Bandwidth:** Saves data for clients and server
- **Performance:** O(1) lookup time (instant checks)

### **Why Unique Client IDs?**

- **Tracking:** Know exactly who's connected
- **Debugging:** Trace issues to specific users
- **Logging:** "Client abc-123 subscribed to BTC"

---

## 📊 Real-World Example

**Scenario:** Trading dashboard with 3 users

```
👤 Alice: Watching BTC + ETH
👤 Bob: Watching SOL only
👤 Charlie: Watching BTC + SOL

New BTC price arrives → Server broadcasts to Alice & Charlie (not Bob!)
New SOL price arrives → Server broadcasts to Bob & Charlie (not Alice!)
New ETH price arrives → Server broadcasts to Alice only
```

**Without subscriptions:** Everyone gets everything (wasteful)  
**With subscriptions:** Everyone gets only what they need (efficient)

---

## 🛡️ Reliability Features

| Feature                   | What It Does                                  |
| ------------------------- | --------------------------------------------- |
| **Auto-Reconnect**        | If Redis disconnects, retries every 3 seconds |
| **Graceful Shutdown**     | On Ctrl+C, closes all connections cleanly     |
| **Error Handling**        | Bad messages don't crash the server           |
| **Heartbeat (PING/PONG)** | Keeps connections alive, detects dead clients |

---

## 🔢 Technical Specs

- **Port:** 8080 (WebSocket protocol)
- **Supported Assets:** BTC, ETH, SOL (expandable)
- **Price Format:** Scaled integers for precision (no float errors)
- **Connection Limit:** Unlimited (memory-bound)
- **Update Frequency:** As fast as Price Poller sends (~1/second)

---

## 🎓 Learning Points

This service demonstrates:

- ✅ **Pub/Sub pattern** for distributed systems
- ✅ **WebSocket protocol** for real-time communication
- ✅ **Subscription management** for efficient broadcasting
- ✅ **Graceful degradation** (reconnection logic)
- ✅ **Separation of concerns** (each service does one job well)

---

## 🚀 Running It

Set Redis URL, then start:

```bash
npm run dev
```

Connect from browser:

```javascript
const ws = new WebSocket("ws://localhost:8080");
```

---

**This is the heart of real-time data delivery in your trading platform** 💓
