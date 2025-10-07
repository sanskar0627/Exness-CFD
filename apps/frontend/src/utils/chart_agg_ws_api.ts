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

  // Using askPrice (previously sellPrice) for candle price source
  const price = toDisplayPrice(trade.bidPrice);
  const bucketSize = getbucketsize(duration);
  const currentbucket = (Math.floor(trade.time / bucketSize) *
    bucketSize) as UTCTimestamp;

  if (!lastCandle || currentbucket > (lastCandle.time as UTCTimestamp)) {
    lastCandle = {
      time: currentbucket,
      open: price,
      high: price,
      low: price,
      close: price,
    };
  } else {
    lastCandle = {
      time: lastCandle.time,
      open: lastCandle.open,
      high: Math.max(lastCandle.high, price),
      low: Math.min(lastCandle.low, price),
      close: price,
    };
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
