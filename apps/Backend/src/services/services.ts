import { TimeDurationCandel, Candle, ValidSymbol } from "../types";
import { fromInternalPrice } from "shared";
import { prisma } from "database";
import { number, string } from "zod";
import { closeOrder } from "../utils/tradeUtils";

const candleArr: Candle[] = [];
//function to give back the candel data OHLC( Open, High, Low, Close,)
export async function getCandelFromDb(
  symbol: ValidSymbol,
  interval: TimeDurationCandel,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  //dividing it in minute easy for the calculation
  const IntervalConfig = {
    "1m": { minutes: 1, pgInterval: "1 minute" },
    "1d": { minutes: 1440, pgInterval: "1 day" },
    "1w": { minutes: 10080, pgInterval: "1 week" },
  } as const;

  //check thier must be a valid asset (asset symbol)
  if (!symbol || symbol.trim() === "") {
    throw new Error("Symbol Parameter is not Thier !");
  }
  // checking  startTime must be before endTime to prevent querying future data
  if (startTime >= endTime) {
    console.log("Cant Show Future Data");
    throw new Error("Something went wrong!, Cant SHow Future Data");
  }
  const SymbolMap = {
    BTC: "BTCUSDT",
    ETH: "ETHUSDT",
    SOL: "SOLUSDT",
  } as const;

  const dbSymbol = SymbolMap[symbol as keyof typeof SymbolMap]; // "BTC" → "BTCUSDT"
  if (!dbSymbol) { //Check that the symbolis correct or not agian 
    throw new Error(`Invalid symbol. Supported: BTC, ETH, SOL for Now`);
  }

  const rangeDuration = (endTime - startTime) / 1000 / 60; //Convert Milliseconds to Seconds (÷ 1000) and Convert Seconds to Minutes (÷ 60)
  const expectedCandles = rangeDuration / IntervalConfig[interval].minutes;
  if (expectedCandles > 1000) {
    // Adjust startTime to give only last 1000 candles
    startTime = endTime - 1000 * IntervalConfig[interval].minutes * 60 * 1000;
    console.log(
      `Too many candles requested (${expectedCandles}). Limiting to 1000 most recent candles.`
    );
  }
  // Convert timestamps
  const startDate = new Date(startTime * 1000);
  const endDate = new Date(endTime * 1000);
  const pgInterval = IntervalConfig[interval].pgInterval;
  // Query database
  const results = await prisma.$queryRaw`
      SELECT
        time_bucket(${pgInterval}, timestamp) AS time,
        (array_agg(price ORDER BY timestamp))[1] AS open,
        MAX(price) AS high,
        MIN(price) AS low,
        (array_agg(price ORDER BY timestamp DESC))[1] AS close,
        SUM(CAST(quantity AS DECIMAL)) AS volume
      FROM "Trade"
      WHERE symbol = ${dbSymbol}
        AND timestamp >= ${startDate}
        AND timestamp <= ${endDate}
      GROUP BY time_bucket(${pgInterval}, timestamp)
      ORDER BY time ASC
      LIMIT 1000;
    `;
    if (!results || (results as any[]).length === 0) {
    console.log(`No candles found for ${dbSymbol} from ${startDate} to ${endDate}`);
    return [];
  }

  // Transform results
  const candles: Candle[] = (results as any[]).map((row) => ({
    time: Math.floor(new Date(row.time).getTime() / 1000),
    open: fromInternalPrice(Number(row.open)),
    high: fromInternalPrice(Number(row.high)),
    low: fromInternalPrice(Number(row.low)),
    close: fromInternalPrice(Number(row.close)),
    volume: row.volume ? row.volume.toString() : "0",
  }));

  return candles;
}
