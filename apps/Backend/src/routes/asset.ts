import { Router } from "express";
import type { Request, Response } from "express";
import { PriceStorageMp } from "../data/store";
import { fromInternalPrice } from "shared";
import { SUPPORTED_ASSETS } from "shared";

export const assetRouter = Router();

// Asset metadata - could be moved to database later
const ASSET_METADATA = {
  BTC: {
    name: "Bitcoin",
    imageUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
  },
  ETH: {
    name: "Ethereum",
    imageUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
  },
  SOL: {
    name: "Solana",
    imageUrl: "https://cryptologos.cc/logos/solana-sol-logo.png",
  },
};

// GET /api/v2/asset - Get all assets with current prices
assetRouter.get("/", (req: Request, res: Response): void => {
  try {
    // Fallback prices for each asset (in case Price_Poller isn't running)
    const FALLBACK_PRICES: Record<string, { bid: number; ask: number }> = {
      BTC: { bid: 64500, ask: 65000 },
      ETH: { bid: 3475, ask: 3500 },
      SOL: { bid: 179, ask: 180 },
    };

    const assets = SUPPORTED_ASSETS.map((symbol) => {
      const priceData = PriceStorageMp.get(symbol);
      const metadata = ASSET_METADATA[symbol];
      const fallback = FALLBACK_PRICES[symbol];

      let buyPrice = fallback.ask;
      let sellPrice = fallback.bid;

      // Use real prices if available and not zero
      if (priceData && priceData.ask > 0 && priceData.bid > 0) {
        buyPrice = fromInternalPrice(priceData.ask);
        sellPrice = fromInternalPrice(priceData.bid);
      }

      return {
        symbol: symbol,
        name: metadata.name,
        buyPrice: buyPrice, // Ask price for buying
        sellPrice: sellPrice, // Bid price for selling
        decimals: 4,
        imageUrl: metadata.imageUrl,
      };
    });

    res.status(200).json({
      assets: assets,
    });
  } catch (error) {
    console.error("[ASSET] Error fetching asset details:", error);
    res.status(500).json({ error: "Failed to fetch asset details" });
  }
});

// GET /api/v2/candles - Get candlestick data (STUB - returns dummy data)
// TODO: Implement real aggregation from Trade table - see TODO.md #1
assetRouter.get("/candles", (req: Request, res: Response): void => {
  try {
    const { asset, ts, startTime, endTime } = req.query;

    // Fallback prices for each asset (in case Price_Poller isn't running)
    const FALLBACK_PRICES: Record<string, number> = {
      BTC: 65000,
      ETH: 3500,
      SOL: 180,
    };

    // Get current price for the asset
    const priceData = PriceStorageMp.get(asset as any);
    const assetFallback = FALLBACK_PRICES[asset as string];
    let currentPrice = assetFallback || 65000;

    // Use real price if available and not zero
    if (priceData && priceData.ask > 0) {
      currentPrice = fromInternalPrice(priceData.ask);
    }

    // Generate dummy candlestick data
    // TODO: Replace with real database query and aggregation
    const candles = [];
    const currentTimeSec = Math.floor(Date.now() / 1000);
    const start = startTime ? Number(startTime) : currentTimeSec - 3600;
    const end = endTime ? Number(endTime) : currentTimeSec;

    // Generate 50 dummy candles for better chart display
    const numCandles = 50;
    for (let i = 0; i < numCandles; i++) {
      const time = start + (i * ((end - start) / numCandles));

      // Generate realistic price variation (±2% from current price)
      const variation = currentPrice * 0.02;
      const open = currentPrice + (Math.random() - 0.5) * variation;
      const close = currentPrice + (Math.random() - 0.5) * variation;
      const high = Math.max(open, close) + Math.random() * (variation / 2);
      const low = Math.min(open, close) - Math.random() * (variation / 2);

      candles.push({
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        timestamp: Math.floor(time),
        decimal: 4,
      });
    }

    res.status(200).json({
      candles: candles,
    });
  } catch (error) {
    console.error("[CANDLES] Error fetching candle data:", error);
    res.status(500).json({ error: "Failed to fetch candle data" });
  }
});
