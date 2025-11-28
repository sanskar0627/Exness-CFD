import express from "express";
import type { Express, Request, Response } from "express";
import cors from "cors";
import { userRouter } from "./routes/user";
import { tradeRoutes } from "./routes/trades";
import { assetRouter } from "./routes/asset";
import { initOrderBroadcast, stopOrderBroadcast } from "./services/orderBroadcast";

const app: Express = express();
const port = Number(process.env.PORT) || 5000;

const allowedOrigins = Bun.env.CORS_ORIGINS?.split(",") || [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
];

// Apply CORS middleware
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.use(express.json());
app.use("/api/v2/user", userRouter);
app.use("/api/v2/trade", tradeRoutes);
app.use("/api/v2/asset", assetRouter);

//catch all undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route Not Found !! Undefined Route" });
});

// Main async function to initialize services and start server
async function main() {
  try {
    // Initialize order broadcast service (Redis connection)
    await initOrderBroadcast();

    // Start Express server
    app.listen(port, () => {
      console.log(`
    Server running on port ${port}
    User API: http://localhost:${port}/api/v2/user
    Trade API: http://localhost:${port}/api/v2/trade
    Asset API: http://localhost:${port}/api/v2/asset`);
    });
  } catch (error) {
    console.error("[SERVER] Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown handler
async function shutdown() {
  console.log("\n[SERVER] Shutting down gracefully...");
  try {
    await stopOrderBroadcast();
    console.log("[SERVER] Order broadcast service stopped");
  } catch (error) {
    console.error("[SERVER] Error during shutdown:", error);
  }
  process.exit(0);
}

// Register shutdown handlers
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start the application
main();
