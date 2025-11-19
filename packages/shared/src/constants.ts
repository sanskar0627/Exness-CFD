export const PRICE_SCALE = 10000; //$65234.5678 stored as 652345678 (integer).
export const USD_SCALE = 100;
export const SUPPORTED_ASSETS = ["BTC", "ETH", "SOL"] as const;
export type Asset = (typeof SUPPORTED_ASSETS)[number];
export const LEVERAGE_OPTIONS = [1, 5, 10, 20, 100] as const;
export type Leverage = (typeof LEVERAGE_OPTIONS)[number];
export const BINANCE_STREAMS = {
  BTC: "btcusdt@aggTrade",
  ETH: "ethusdt@aggTrade",
  SOL: "solusdt@aggTrade",
} as const;
