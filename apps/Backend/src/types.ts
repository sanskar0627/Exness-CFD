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
export const PriceDataSchema = z.object({
  bidPrice: z.number(), // Sell price in PRICE_SCALE
  askPrice: z.number(), // Buy price in PRICE_SCALE
  time: z.number(),
});

// Trading Types
export type TimeDurationCandel = "1m" | "1d" | "1w";
export type OrderType = "buy" | "sell";
export type OrderStatus = "OPEN" | "CLOSED" | "LIQUIDATED";
export type reasonForClose =
  | "manual"
  | "take_profit"
  | "stop_loss"
  | "liquidation";
export interface Order {
  orderId: string; // UUID
  userId: string; // UUID
  asset: Asset; // BTC, ETH, or SOL
  type: OrderType; // buy or sell
  margin: number; // Current collateral in cents (can increase with addMargin)
  initialMargin: number; // Original margin when position was opened
  addedMargin: number; // Additional margin added (default: 0)
  leverage: Leverage; // Original leverage (1, 5, 10, 20, or 100)
  openPrice: number; // Entry price in PRICE_SCALE (e.g., $60,000.50 = 600005000)
  openTimestamp: number; // Unix timestamp in milliseconds
  liquidationPrice: number; // Liquidation price in PRICE_SCALE
  takeProfit?: number; // Optional take-profit price in PRICE_SCALE
  stopLoss?: number; // Optional stop-loss price in PRICE_SCALE
  trailingStopLoss?: {
    enabled: boolean; // Is trailing stop loss active
    trailingDistance: number; // Distance from peak/trough in PRICE_SCALE
    highestPrice?: number; // Highest price reached (for BUY orders)
    lowestPrice?: number; // Lowest price reached (for SELL orders)
  };
}

export interface ClosedOrder extends Order {
  closePrice: number; // Exit price in PRICE_SCALE
  closeTimestamp: number; // Unix timestamp in milliseconds
  pnl: number; // Profit/Loss in cents (can be negative)
  closeReason: "manual" | "take_profit" | "stop_loss" | "liquidation";
}
export interface redisPriceData {
  bid: number; // Sell price in PRICE_SCALE
  ask: number; // Buy price in PRICE_SCALE
  decimals: number;
  time: number;
}
export interface IncomingredisPriceData {
  bidPrice: number; // Sell price in PRICE_SCALE
  askPrice: number; // Buy price in PRICE_SCALE
  time: number;
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
  trailingStopLoss?: {
    enabled: boolean;
    trailingDistance: number; // Distance in USD (will be converted to PRICE_SCALE)
  };
}

export interface CloseTradeRequest {
  orderId: string;
}

export interface PartialCloseRequest {
  orderId: string;
  percentage: number; // Percentage to close (1-99)
}

export interface AddMarginRequest {
  orderId: string;
  additionalMargin: number; // USD amount to add (will be converted to cents)
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
  trailingStopLoss: z.object({
    enabled: z.boolean(),
    trailingDistance: z.number().positive("Trailing distance must be positive"),
  }).optional(),
});

export const closeTradeSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});

export const partialCloseSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  percentage: z
    .number()
    .min(1, "Minimum percentage is 1%")
    .max(99, "Maximum percentage is 99%"),
});

export const addMarginSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  additionalMargin: z
    .number()
    .positive("Additional margin must be positive")
    .min(10, "Minimum additional margin is $10"),
});

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
}
export type ValidSymbol = "BTC" | "ETH" | "SOL";

//CloseDecsion Interface 
export interface CloseDecsion{
  reason:reasonForClose,
  price:number
}

export const SnapShot_Interval=1000; //10 second's