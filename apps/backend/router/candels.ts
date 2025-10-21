import { Router } from "express";
import { RedisManager } from "../utils/redisClient.js";
import logger from "../utils/logger.js";

export const candelrouter = Router();

// Price precision constant - prices are stored as integers (multiply by 10000)
const PRECISION = 10000;

function fromInternalPrice(price: number): number {
  return price / PRECISION;
}

interface CandlestickData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  interval: string;
}

candelrouter.get("/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = "1m", limit = "100" } = req.query;

    if (!symbol) {
      return res.status(400).json({
        error: "Symbol parameter is required"
      });
    }

    // Get current price data using the static method
    const priceData = await RedisManager.getCurrentPrice(symbol.toUpperCase());
    
    if (!priceData) {
      return res.status(404).json({
        error: `No price data found for symbol ${symbol.toUpperCase()}`
      });
    }

    const now = Date.now();

    // Generate mock candlestick data based on current price
    // In a real application, this would fetch historical data from a database
    const candlesticks: CandlestickData[] = [];
    const limitNum = Math.min(parseInt(limit as string) || 100, 1000);

    // Generate historical candlestick data (mock)
    // Convert from internal price format to display format
    let basePrice = fromInternalPrice(priceData.bid || 500000000);
    
    for (let i = limitNum - 1; i >= 0; i--) {
      const timestamp = now - (i * 60000); // 1 minute intervals
      
      // Generate realistic price movement
      const volatility = basePrice * 0.002; // 0.2% volatility
      const change = (Math.random() - 0.5) * volatility;
      
      const open = basePrice;
      const close = basePrice + change;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      const volume = Math.random() * 1000000;
      
      candlesticks.push({
        symbol: symbol.toUpperCase(),
        open: parseFloat(open.toFixed(8)),
        high: parseFloat(high.toFixed(8)),
        low: parseFloat(low.toFixed(8)),
        close: parseFloat(close.toFixed(8)),
        volume: parseFloat(volume.toFixed(2)),
        timestamp,
        interval: interval as string
      });
      
      basePrice = close;
    }

    logger.info(`📊 Candlestick data requested for ${symbol.toUpperCase()}, returning ${candlesticks.length} candles`);

    return res.json({
      symbol: symbol.toUpperCase(),
      interval,
      data: candlesticks
    });

  } catch (error) {
    logger.error("Error fetching candlestick data:", error);
    return res.status(500).json({
      error: "Internal server error while fetching candlestick data"
    });
  }
});

// Get available symbols
candelrouter.get("/", async (req, res) => {
  try {
    // Return predefined symbols that are available in the system
    const symbols = ["BTC", "ETH", "SOL"];

    return res.json({
      symbols,
      message: "Available symbols for candlestick data"
    });
  } catch (error) {
    logger.error("Error fetching available symbols:", error);
    return res.status(500).json({
      error: "Internal server error while fetching symbols"
    });
  }
});