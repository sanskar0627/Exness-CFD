import axios from 'axios';
import { prisma } from '../packages/database/src/index';

/**
 * Historical Data Seeder for Trading Application
 * 
 * This script fetches historical trade data from Binance API and populates
 * the Trade table to provide sufficient historical candles for charts.
 */

interface BinanceTrade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const;
const BATCH_SIZE = 1000; // Binance API limit per request
const TOTAL_TRADES_PER_SYMBOL = 10000; // Total trades to fetch per symbol

/**
 * Fetch historical trades from Binance API
 */
async function fetchBinanceTrades(
  symbol: string,
  fromId?: number
): Promise<BinanceTrade[]> {
  try {
    const url = 'https://api.binance.com/api/v3/historicalTrades';
    const params: any = {
      symbol,
      limit: BATCH_SIZE,
    };
    
    if (fromId) {
      params.fromId = fromId;
    }

    const response = await axios.get(url, { params });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(`Binance API Error for ${symbol}:`, error.response?.data || error.message);
    } else {
      console.error(`Error fetching trades for ${symbol}:`, error);
    }
    throw error;
  }
}

/**
 * Convert Binance price to internal format (multiply by 10000)
 */
function toInternalPrice(price: string): bigint {
  const numPrice = parseFloat(price);
  return BigInt(Math.round(numPrice * 10000));
}

/**
 * Seed historical trades for a single symbol
 */
async function seedSymbol(symbol: string): Promise<void> {
  console.log(`\nStarting to seed ${symbol}...`);
  
  let totalInserted = 0;
  let lastTradeId: number | undefined = undefined;
  let batchCount = 0;
  const maxBatches = Math.ceil(TOTAL_TRADES_PER_SYMBOL / BATCH_SIZE);

  while (batchCount < maxBatches) {
    try {
      console.log(`  Fetching batch ${batchCount + 1}/${maxBatches} for ${symbol}...`);
      
      const trades = await fetchBinanceTrades(symbol, lastTradeId);
      
      if (trades.length === 0) {
        console.log(` No more trades available for ${symbol}`);
        break;
      }

      // Transform trades to database format
      const dbTrades = trades.map(trade => ({
        tradeId: BigInt(trade.id),
        symbol: symbol,
        price: toInternalPrice(trade.price),
        quantity: trade.qty,
        timestamp: new Date(trade.time),
      }));

      // Insert into database
      const result = await prisma.trade.createMany({
        data: dbTrades,
        skipDuplicates: true,
      });

      totalInserted += result.count;
      lastTradeId = trades[trades.length - 1].id + 1;
      batchCount++;

      console.log(` Inserted ${result.count} trades (Total: ${totalInserted})`);

      // Rate limiting - Binance allows 1200 requests/minute
      // Sleep for 100ms between requests to be safe
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: unknown) {
      console.error(`Error seeding batch ${batchCount + 1} for ${symbol}:`, error);
      
      // If we hit rate limit, wait longer
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        console.log(`Rate limited. Waiting 60 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 60000));
        continue; // Retry the same batch
      }
      
      // For other errors, continue to next batch
      batchCount++;
    }
  }

  console.log(`Completed seeding ${symbol}: ${totalInserted} trades inserted\n`);
}

/**
 * Main seeding function
 */
async function seedHistoricalData(): Promise<void> {
  console.log(' Starting Historical Data Seeding...\n');
  console.log(`Symbols to seed: ${SYMBOLS.join(', ')}`);
  console.log(`Target trades per symbol: ${TOTAL_TRADES_PER_SYMBOL}\n`);

  const startTime = Date.now();

  try {
    // Seed each symbol sequentially to avoid overwhelming the API
    for (const symbol of SYMBOLS) {
      await seedSymbol(symbol);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\ Seeding completed successfully in ${duration} seconds!`);
    
    // Show summary
    console.log('\ Database Summary:');
    const summary = await prisma.$queryRaw<Array<{
      symbol: string;
      count: bigint;
      earliest: Date;
      latest: Date;
    }>>`
      SELECT 
        symbol,
        COUNT(*) as count,
        MIN(timestamp) as earliest,
        MAX(timestamp) as latest
      FROM "Trade"
      GROUP BY symbol
      ORDER BY symbol
    `;
    
    summary.forEach((row: { symbol: string; count: bigint; earliest: Date; latest: Date }) => {
      console.log(`  ${row.symbol}: ${row.count.toString()} trades`);
      console.log(`    Earliest: ${row.earliest.toISOString()}`);
      console.log(`    Latest: ${row.latest.toISOString()}`);
    });

  } catch (error) {
    console.error('\ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
seedHistoricalData()
  .then(() => {
    console.log('\Seeder script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\ Seeder script failed:', error);
    process.exit(1);
  });
