# Exness CFD Trading Platform

A TypeScript-based real-time CFD (Contract for Difference) trading platform supporting Bitcoin, Ethereum, and Solana with leveraged positions up to 100x. Built as a monorepo with event-driven architecture for sub-20ms price updates from Binance to client.

## Architecture

The system consists of four independent services communicating through Redis pub/sub and Kafka streams. Price data flows from Binance WebSocket through an EventEmitter fan-out pattern to both real-time distribution (Redis) and historical persistence (Kafka → PostgreSQL). The Backend maintains in-memory order state with periodic snapshots to PostgreSQL for crash recovery, while the WebSocket service handles authenticated client connections with dual Redis subscriptions for prices and user-specific order events.

```mermaid
graph TB
    A[Binance WebSocket] -->|Price Stream| B[Price_Poller]
    B -->|Pub/Sub| C[Redis]
    B -->|Events| D[Kafka]
    D -->|Batch Write| E[(PostgreSQL + TimescaleDB)]
    C -->|Subscribe| F[WebSocket Server]
    G[Frontend] -->|HTTP/JWT| H[Backend API]
    G -.->|WS| F
    H -->|Read/Write| E
    H -->|Order Events| C
    H -->|Price Read| C
    F -->|Broadcast| G

    style B fill:#e1f5ff
    style H fill:#ffe1e1
    style F fill:#e1ffe1
    style G fill:#fff5e1
```

**ASCII Flow:**
```
┌─────────────┐
│   Binance   │ (Price Source)
└──────┬──────┘
       │
       v
┌─────────────┐
│Price_Poller │ (EventEmitter Fan-out)
└──┬────────┬─┘
   │        │
   │        └──────────> Kafka ──> PostgreSQL (Historical)
   │
   └──────> Redis (Real-time)
              │
              ├──> WebSocket ──> Frontend (Live Updates)
              │
              └──> Backend ──> PostgreSQL (Orders/Users)
                     │
                     └──> Frontend (REST API)
```

## Components

### 🔴 Backend
**Location:** `apps/Backend`
**Tech Stack:** Express + Prisma + PostgreSQL + Redis
**Responsibilities:**
- JWT authentication and OAuth integration (Google, GitHub)
- Trading operations: open/close/partial-close positions with TP/SL/TSL
- Automated position monitoring for liquidations and take-profit/stop-loss execution
- State restoration from PostgreSQL on startup
- Periodic snapshots every 10 seconds for crash recovery
- Real-time order broadcasting via Redis pub/sub

---

### 🟡 Frontend
**Location:** `apps/Frontend`
**Tech Stack:** React 19 + Vite + TailwindCSS + lightweight-charts
**Responsibilities:**
- Real-time price charts with candlestick visualization
- Buy/Sell panel with margin and leverage controls
- WebSocket integration for live order updates
- OAuth authentication flows
- Toast notifications for trade events

---

### 🔵 Price_Poller
**Location:** `apps/Price_Poller`
**Tech Stack:** Binance WebSocket + Redis + Kafka + EventEmitter
**Responsibilities:**
- Connect to Binance streams (BTC/ETH/SOL aggregate trades)
- Convert prices to internal representation (×10000 for precision)
- Fan out via EventEmitter to Redis publisher and Kafka producer
- Batch processing: 500 trades or 5-second timeout for database writes
- Deduplication using Binance tradeId

---

### 🟢 WebSocket Server
**Location:** `apps/Websocket`
**Tech Stack:** ws library + Dual Redis clients
**Responsibilities:**
- Maintain separate Redis subscriptions for prices (BTC/ETH/SOL) and order events (orders:userId)
- JWT authentication via query parameters
- Broadcast user-specific order events to authenticated connections only
- Real-time price distribution with sub-20ms latency

---

### 📦 Shared Packages

**`packages/database`**
- Prisma schema with 7 models: Trade, User, ActiveOrder, ClosedOrder, UserSnapshot, OrderSnapshot, PlatformProfit
- PostgreSQL with TimescaleDB for time-series optimization
- Auto-generated Prisma client in `generated/prisma/`

**`packages/shared`**
- Constants: `PRICE_SCALE = 10000`, `USD_SCALE = 100`, `SUPPORTED_ASSETS`, `LEVERAGE_OPTIONS`
- Utilities: `toInternalPrice()`, `fromInternalPrice()`, `toInternalUSD()`, `fromInternalUSD()`

## Setup

Install dependencies and start infrastructure services:

```bash
bun install
docker-compose up -d
```

Create environment file at `apps/Backend/.env`:

```env
DATABASE_URL=postgresql://user:XYZ@123@localhost:5432/trades_db
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
JWT_SECRET=your-secret-min-32-characters
NODE_ENV=development
PORT=5000
INITIAL_BALANCE_USD=5000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Initialize database and seed historical data:

```bash
bun run prisma generate
bun run prisma migrate dev
bun run seed-data
```

The seeding process fetches 7 days of historical price data from Binance and takes approximately 5-10 minutes.

## Run

Start all services concurrently:

```bash
bun run dev
```

**Access URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api/v2
- WebSocket: ws://localhost:8080
- Prisma Studio: `bun run prisma studio` → http://localhost:5555

Run individual services:

```bash
cd apps/Backend && bun run dev
cd apps/Frontend && bun run dev
cd apps/Price_Poller && bun run src/index.ts
cd apps/Websocket && bun run src/index.ts
```

## API Reference

### Authentication
```bash
POST /api/v2/user/signup     # Register with email/password
POST /api/v2/user/signin     # Login, returns JWT token
GET  /api/v2/user/balance    # Requires Authorization: Bearer <token>
```

### OAuth
```bash
GET  /api/v2/auth/google              # Initiate Google OAuth
GET  /api/v2/auth/github              # Initiate GitHub OAuth
POST /api/v2/auth/link/google         # Link Google to existing account
POST /api/v2/auth/link/github         # Link GitHub to existing account
```

### Trading
```bash
POST /api/v2/trade/open               # Open position (supports TP/SL/TSL)
POST /api/v2/trade/close              # Close position, returns PnL
POST /api/v2/trade/partial-close      # Close 1-99% of position
POST /api/v2/trade/add-margin         # Add collateral to reduce liquidation risk
GET  /api/v2/trade/open               # List active positions
GET  /api/v2/trade/history            # Closed trades with PnL
```

### Market Data
```bash
GET /api/v2/asset/                    # List assets with current prices
GET /api/v2/asset/candles             # Candlestick data (TimescaleDB)
```

All trading endpoints require JWT authentication via `Authorization: Bearer <token>` header. Rate limiting is enforced globally and per-endpoint.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Package Manager** | Bun 1.3.0 |
| **Monorepo** | Turborepo |
| **Language** | TypeScript 5.9.2 |
| **Database** | PostgreSQL + TimescaleDB + Prisma ORM |
| **Cache** | Redis |
| **Message Queue** | Kafka |
| **Backend** | Express + Node.js |
| **Frontend** | React 19 + Vite 7 + TailwindCSS 4 |
| **Charts** | lightweight-charts 5.0 |
| **WebSocket** | ws library |
| **Real-time Data** | Binance WebSocket API |

## License

This project is private and proprietary By Sanskar Shukla.
