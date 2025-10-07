import { z } from "zod";

export const credentialSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(20),
});

export const tradeSchema = z.object({
  asset: z.enum(["BTC", "ETH", "SOL"]),
  type: z.enum(["buy", "sell"]),
  margin: z.number().positive(),
  leverage: z.union([
    z.literal(1),
    z.literal(5),
    z.literal(10),
    z.literal(20),
    z.literal(100),
  ]),
  // Optional risk params in display price units (e.g. 65000.12)
  takeProfit: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
});