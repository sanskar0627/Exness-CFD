import { Router } from "express";
import { RedisManager } from "../utils/redisClient.js";

export const assetrouter = Router();

// Price precision constant - prices are stored as integers (multiply by 10000)
const PRECISION = 10000;

function fromInternalPrice(price: number): number {
  return price / PRECISION;
}

assetrouter.get("/", async (req, res) => {
  const assetDetails = [
    {
      name: "Bitcoin",
      symbol: "BTC",
      decimals: 4,
      imageUrl:
        "https://i.postimg.cc/TPh0K530/87496d50-2408-43e1-ad4c-78b47b448a6a.png",
    },
    {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 4,
      imageUrl:
        "https://i.postimg.cc/gcKhPkY2/3a8c9fe6-2a76-4ace-aa07-415d994de6f0.png",
    },
    {
      name: "Solana",
      symbol: "SOL",
      decimals: 4,
      imageUrl:
        "https://i.postimg.cc/9MhDvsK9/b2f0c70f-4fb2-4472-9fe7-480ad1592421.png",
    },
  ];

  const responseAssets = await Promise.all(
    assetDetails.map(async (asset) => {
      const priceData = await RedisManager.getCurrentPrice(asset.symbol);

      if (!priceData) {
        return {
          name: asset.name,
          symbol: asset.symbol,
          buyPrice: 0,
          sellPrice: 0,
          decimals: asset.decimals,
          imageUrl: asset.imageUrl,
        };
      }

      return {
        name: asset.name,
        symbol: asset.symbol,
        buyPrice: fromInternalPrice(priceData.ask), //buy price is(more one)
        sellPrice: fromInternalPrice(priceData.bid), // sell price
        decimals: asset.decimals,
        imageUrl: asset.imageUrl,
      };
    })
  );

  res.status(200).json({ assets: responseAssets });
});