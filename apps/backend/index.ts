import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import logger from "./utils/logger.js";
import { securityHeaders, corsOptions } from "./middleware/security.js";
import { errorHandler, notFoundHandler, healthCheck, asyncHandler } from "./middleware/errorHandler.js";
import { userRouter } from "./router/user.js";
import { RedisManager } from "./utils/redisClient.js";
import { tradesRouter } from "./router/trades.js";
import { assetrouter } from "./router/asset.js";
import { tradeRouter } from "./router/trade.js";
import { candelrouter } from "./router/candels.js";
import { checkOpenPositions } from "./services/orderMonitoring.js";
import prisma from "./lib/prisma.js";
import { cacheService } from "./services/cacheService.js";

export const app = express();

// Basic middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Simple request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', healthCheck);

// API routes
app.use("/api/v1/trades", tradesRouter);
app.use("/api/v1/trade", tradeRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/asset", assetrouter);
app.use("/api/v1/candlestick", candelrouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize services
async function initializeServices() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info("✅ Database connected");

    // Initialize cache service
    await cacheService.initialize();
    logger.info("✅ Cache service initialized");

    // Initialize Redis and price updates
    const redis = await RedisManager.getInstance();
    logger.info("✅ Redis connected");
    
    const assets = ["BTC", "ETH", "SOL"];
    for (const asset of assets) {
      await redis.subscribe(asset, (msg: string) => {
        try {
          const data = JSON.parse(msg);
          // Price data is already stored in Redis by price_poller
          checkOpenPositions(asset, { ask: data.askPrice, bid: data.bidPrice });
        } catch (error) {
          logger.error(`Failed to process price update for ${asset}`, error);
        }
      });
    }

    logger.info("✅ All services initialized");
  } catch (error) {
    logger.error("❌ Failed to initialize services", error);
    throw error;
  }
}

// Start server
async function startServer() {
  try {
    await initializeServices();

    const server = app.listen(config.PORT, '0.0.0.0', () => {
      logger.info(`🚀 HTTP Server running on port ${config.PORT}`);
      logger.info(`🌐 Server accessible at http://localhost:${config.PORT}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      
      try {
        await cacheService.shutdown();
        await prisma.$disconnect();
        server.close(() => {
          logger.info("Server closed");
          process.exit(0);
        });
      } catch (error) {
        logger.error("Error during shutdown", error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

// Start the application
if (process.env.NODE_ENV !== 'test') {
  startServer();
}