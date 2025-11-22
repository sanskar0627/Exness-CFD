import express from "express";
import type { Express, Request, Response } from "express";
import cors from "cors";
import { userRouter } from "./routes/user";
import { tradeRoutes } from "./routes/trades";

const app: Express = express();
const port = Number(process.env.PORT) || 5000;

const allowedOrigins = Bun.env.CORS_ORIGINS?.split(",") || [
  "http://localhost:3000",
  "http://localhost:5173",
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

//catch all undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route Not Found !! Undefined Route" });
});

app.listen(port, () => {
  console.log(`
    Server running on port ${port}
    User API: http://localhost:${port}/api/v2/user
    Trade API: http://localhost:${port}/api/v2/trade`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[SERVER] Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[SERVER] Shutting down gracefully...");
  process.exit(0);
});
