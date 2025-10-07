import { Router } from "express";

export const candelrouter = Router();

candelrouter.get("/", async (req, res) => {
  // TODO: Implement candlestick data endpoint with Prisma
  return res.status(501).json({
    message: "Candlestick data endpoint not yet implemented",
    note: "This feature will be available in a future update"
  });
});