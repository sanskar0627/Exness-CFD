import type { Asset, Leverage } from "shared";
import { z } from "zod";

export interface User {
  userId: string;
  email: string;
  password: string;
  balance: {
    usd_balance: number; // Example: $50.00 = 5000 cents, $5000.00 = 500000 cents
  };
  assets: Record<Asset, number>; // Crypto holdings per asset Example: { BTC: 0.5, ETH: 2.0, SOL: 100.0 }
}

export interface JWTPayload {
  userId: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

export interface SigninRequest {
  email: string;
  password: string;
}

// Zod validation schemas for request validation
export const signupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signinSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Trading Types
export type OrderType = "buy" | "sell";
export type OrderStatus = "OPEN" | "CLOSED" | "LIQUIDATED";

export interface Order {
  orderId: string; // UUID
  userId: string; // UUID
  asset: Asset; // BTC, ETH, or SOL
  type: OrderType; // buy or sell
  margin: number; // Collateral in cents (e.g., $1000.00 = 100000)
  leverage: Leverage; // 1, 5, 10, 20, or 100
  openPrice: number; // Entry price in PRICE_SCALE (e.g., $60,000.50 = 600005000)
  openTimestamp: number; // Unix timestamp in milliseco
  // nds
  liquidationPrice: number; // Liquidation price in PRICE_SCALE
  takeProfit?: number; // Optional take-profit price in PRICE_SCALE
  stopLoss?: number; // Optional stop-loss price in PRICE_SCALE
}

export interface ClosedOrder extends Order {
  closePrice: number; // Exit price in PRICE_SCALE
  closeTimestamp: number; // Unix timestamp in milliseconds
  pnl: number; // Profit/Loss in cents (can be negative)
  closeReason: "manual" | "take_profit" | "stop_loss" | "liquidation";
}

export interface PriceData {
  bid: number; // Sell price in PRICE_SCALE
  ask: number; // Buy price in PRICE_SCALE
}

export interface OpenTradeRequest {
  asset: Asset;
  type: OrderType;
  margin: number; // USD amount (e.g., 1000.50) - will be converted to cents
  leverage: Leverage;
  takeProfit?: number; // Optional take-profit price in USD
  stopLoss?: number; // Optional stop-loss price in USD
}

export interface CloseTradeRequest {
  orderId: string;
}

// Zod validation schemas for trading requests
export const openTradeSchema = z.object({
  asset: z.enum(["BTC", "ETH", "SOL"]),
  type: z.enum(["buy", "sell"]),
  leverage: z.union([
    z.literal(1),
    z.literal(5),
    z.literal(10),
    z.literal(20),
    z.literal(100),
  ]),
  margin: z
    .number()
    .positive("Margin must be positive")
    .min(10, "Minimum margin is $10"),
  takeProfit: z.number().optional(),
  stopLoss: z.number().optional(),
});

export const closeTradeSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});
