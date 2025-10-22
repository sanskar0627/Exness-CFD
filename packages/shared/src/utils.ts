import { PRICE_SCALE, USD_SCALE } from "./constants";

export function toInternalPrice(price: number): number {
  return Math.floor(price * PRICE_SCALE);
}

export function fromInternalPrice(price: number): number {
  return price / PRICE_SCALE;
}

export function toInternalUSD(usd: number): number {
  return Math.floor(usd * USD_SCALE);
}

export function fromInternalUSD(cents: number): number {
  return cents / USD_SCALE;
}

export function calculateAskPrice(bid: number): number {
  return Math.floor(bid * 1.01);
}
