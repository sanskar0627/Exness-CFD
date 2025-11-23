export const Duration = {
  candles_1m: "1m",
  candles_1w: "1w",
  candles_1d: "1d",
} as const;
export type Duration = (typeof Duration)[keyof typeof Duration];

export const Channels = {
  SOLUSDT: "SOL",
  ETHUSDT: "ETH",
  BTCUSDT: "BTC",
} as const;
export type SYMBOL = (typeof Channels)[keyof typeof Channels];
