import { type CandlestickData, type UTCTimestamp } from "lightweight-charts";
import { getKlineData } from "../api/trade";
import { Duration, type SYMBOL } from "../utils/constants";
import { toDisplayPrice } from "./utils";

export interface RealtimeUpdate {
  symbol: SYMBOL;
  bidPrice: number;
  askPrice: number;
  time: number;
}

function getbucketsize(duration: Duration): number {
  switch (duration) {
    case "1m":
      return 60;
    case "1d":
      return 86400;
    case "1w":
      return 604800;
    default:
      console.warn("invalid duration", duration);
      return 0;
  }
}

const lastCandles: Record<string, CandlestickData | null> = {};

function key(symbol: SYMBOL, duration: Duration) {
  return `${symbol}_${duration}`;
}

export function processRealupdate(
  trade: RealtimeUpdate,
  duration: Duration,
): CandlestickData {
  const k = key(trade.symbol, duration);
  let lastCandle = lastCandles[k];

  // Use mid-price (average of bid and ask) for more accurate candle representation
  // This represents the market price better than using only bid or ask
  const bidDisplay = toDisplayPrice(trade.bidPrice);
  const askDisplay = toDisplayPrice(trade.askPrice);
  const price = (bidDisplay + askDisplay) / 2;

  const bucketSize = getbucketsize(duration);
  const currentbucket = (Math.floor(trade.time / bucketSize) *
    bucketSize) as UTCTimestamp;

  // Check if we need to create a new candle (new time bucket)
  if (!lastCandle || currentbucket > (lastCandle.time as UTCTimestamp)) {
    // New candle - starting a new time period
    lastCandle = {
      time: currentbucket,
      open: price,
      high: price,
      low: price,
      close: price,
    };
    // Only log new candles (not every update)
    console.log(`[CANDLE] New ${duration} candle for ${trade.symbol} at ${new Date(currentbucket * 1000).toISOString()}`);
  } else {
    // Update existing candle - same time bucket
    lastCandle = {
      time: lastCandle.time,
      open: lastCandle.open,  // Open never changes
      high: Math.max(lastCandle.high, price),
      low: Math.min(lastCandle.low, price),
      close: price,  // Close always updates to latest price
    };
    // No logging for regular updates to avoid console spam
  }

  lastCandles[k] = lastCandle;
  return lastCandle;
}

export function initLastCandle(
  symbol: SYMBOL,
  duration: Duration,
  data: CandlestickData[],
) {
  const k = key(symbol, duration);
  lastCandles[k] = data.length > 0 ? data[data.length - 1] : null;
}

export async function getChartData(symbol: SYMBOL, duration: Duration) {
  const response = await getKlineData(symbol, duration);
  console.log("response", response);
  initLastCandle(symbol, duration, response.candles);
  return response.candles;
}

export function resetLastCandle(symbol: SYMBOL, duration: Duration) {
  const k = key(symbol, duration);
  delete lastCandles[k];
}
