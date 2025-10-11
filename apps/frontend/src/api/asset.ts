import axios from "axios";
import type { Asset } from "../types/asset";

// Fallback asset data for when API is unavailable
export const fallbackAssets: Asset[] = [
  {
    name: "Bitcoin",
    symbol: "BTC",
    buyPrice: 43000,
    sellPrice: 43100,
    decimals: 4,
    imageUrl: "https://i.postimg.cc/TPh0K530/87496d50-2408-43e1-ad4c-78b47b448a6a.png"
  },
  {
    name: "Ethereum",
    symbol: "ETH",
    buyPrice: 2500,
    sellPrice: 2520,
    decimals: 4,
    imageUrl: "https://i.postimg.cc/gcKhPkY2/3a8c9fe6-2a76-4ace-aa07-415d994de6f0.png"
  },
  {
    name: "Solana",
    symbol: "SOL",
    buyPrice: 150,
    sellPrice: 152,
    decimals: 4,
    imageUrl: "https://i.postimg.cc/9MhDvsK9/b2f0c70f-4fb2-4472-9fe7-480ad1592421.png"
  }
];

/**
 * Fetches asset details from the backend API
 * Falls back to fallback data if API is unavailable
 */
export async function getAssetDetails(): Promise<Asset[]> {
  try {
    const token = localStorage.getItem("token") || 
                  document.cookie
                    .split("; ")
                    .find((row) => row.startsWith("Authorization="))
                    ?.split("=")[1];

    const response = await axios.get("http://localhost:5000/api/v1/asset", {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    });

    if (response.data && response.data.assets && Array.isArray(response.data.assets)) {
      return response.data.assets;
    }

    return fallbackAssets;
  } catch (error) {
    console.warn("Failed to fetch asset details, using fallback data:", error);
    return fallbackAssets;
  }
}

/**
 * Fetches details for a specific asset by symbol
 */
export async function getAssetBySymbol(symbol: string): Promise<Asset | null> {
  try {
    const assets = await getAssetDetails();
    return assets.find(asset => asset.symbol === symbol) || null;
  } catch (error) {
    console.error("Failed to fetch asset by symbol:", error);
    return fallbackAssets.find(asset => asset.symbol === symbol) || null;
  }
}