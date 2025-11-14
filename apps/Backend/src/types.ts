import type { Asset } from "shared";
import { z } from "zod";

export interface User {
  userId: string;
  email: string;
  password: string;
  balance: {
    usd_balance: number;// Example: $50.00 = 5000 cents, $5000.00 = 500000 cents
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
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const signinSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters")
});
