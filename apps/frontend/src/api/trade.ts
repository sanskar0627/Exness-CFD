/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { toDisplayPrice } from "../utils/utils";
import type { SYMBOL } from "../utils/constants";
import type { Asset } from "../types/asset";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
export async function getKlineData(
  asset: any,
  duration: any,
  startTime?: any,
  endTime?: string,
) {
  const currentTimeSec = Math.floor(Date.now() / 1000);

  const startTimestamp = startTime ? Number(startTime) : currentTimeSec - 3600;
  const endTimestamp = endTime ? Number(endTime) : currentTimeSec;

  const res = await axios.get(`${BASE_URL}/candlestick/${asset}`, {
    params: {
      interval: duration,
      limit: 100,
      startTime: startTimestamp,
      endTime: endTimestamp,
    },
  });

  if (res.data && Array.isArray(res.data.data)) {
    res.data.candles = res.data.data.map((candle: any) => ({
      open: toDisplayPrice(candle.open),
      high: toDisplayPrice(candle.high),
      low: toDisplayPrice(candle.low),
      close: toDisplayPrice(candle.close),
      time: Math.floor(candle.timestamp / 1000), // Convert to seconds for charts
      decimal: 8,
    }));
  }
  return res.data;
}

export async function submitsignup(email: string, pass: string) {
  try {
    const res = await axios.post(
      `${BASE_URL}/user/signup`,
      {
        email: email,
        password: pass,
      },
      {
        withCredentials: true,
      },
    );
    return res.data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      return e.response?.data || { message: 'Network error' };
    }
    return { message: (e as Error).message };
  }
}

export async function submitsignin(email: string, pass: string) {
  try {
    const res = await axios.post(
      `${BASE_URL}/user/signin`,
      {
        email: email,
        password: pass,
      },
      {
        withCredentials: true,
      },
    );
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return error.response?.data || { message: 'Network error' };
    }
    return { message: (error as Error).message };
  }
}

export async function findUserAmount() {
  try {
    const token = localStorage.getItem("token");

    if (!token) {
      return { message: "No token found" };
    }

    const res = await axios.get(`${BASE_URL}/user/balance`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      withCredentials: true,
    });
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return error.response?.data || error;
    }
    return { message: "Authentication failed" };
  }
}

export async function getopentrades(token: string) {
  try {
    const data = await axios.get(`${BASE_URL}/trades/open`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      withCredentials: true,
    });
    return data;
  } catch (e) {
    throw new Error((e as Error).message);
  }
}

export async function getclosedtrades(token: string) {
  try {
    const data = await axios.get(`${BASE_URL}/trades`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      withCredentials: true,
    });
    return data;
  } catch (e) {
    throw new Error((e as Error).message);
  }
}

export async function closetrade(token: string, orderId: string) {
  try {
    const data = await axios.post(
      `${BASE_URL}/trade/close`,
      {
        orderid: orderId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
      },
    );
    return data;
  } catch (e) {
    throw new Error((e as Error).message);
  }
}

export async function createTrade({
  symbol,
  activeTab,
  margin,
  leverage,
  tpEnabled,
  tpPrice,
  slEnabled,
  slPrice,
  token,
}: {
  symbol: SYMBOL;
  activeTab: "buy" | "sell";
  margin: number;
  leverage: number;
  tpEnabled: boolean;
  tpPrice: string;
  slEnabled: boolean;
  slPrice: string;
  token: string;
}) {
  try {
    const payload: any = {
      asset: symbol,
      type: activeTab,
      leverage,
    };

    // Convert margin to cents as expected by backend
    payload["margin"] = margin; // Backend expects dollars, not cents

    if (tpEnabled && tpPrice) {
      const tpValue = Number(tpPrice);
      if (tpValue > 0) {
        payload.takeProfit = tpValue;
      }
    }
    
    if (slEnabled && slPrice) {
      const slValue = Number(slPrice);
      if (slValue > 0) {
        payload.stopLoss = slValue;
      }
    }

    console.log("📤 Sending trade data to backend:", {
      ...payload,
      margin: `${margin} USD (${payload.margin} cents)`,
      symbol,
      token: token ? "***provided***" : "missing"
    });

    const response = await axios.post(`${BASE_URL}/trade`, payload, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      withCredentials: true,
    });

    console.log("✅ Trade response received:", response.data);
    return { data: response.data };
  } catch (error) {
    console.error("❌ Trade creation failed:", error);
    
    if (axios.isAxiosError(error)) {
      console.error("📊 Error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      console.error("🔍 Full backend response:", JSON.stringify(error.response?.data, null, 2));
      
      // Throw with detailed error information
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error ||
                          `HTTP ${error.response?.status}: ${error.response?.statusText}` ||
                          error.message ||
                          "Network error occurred";
      
      throw new Error(errorMessage);
    }
    
    throw error;
  }
}

export const fallbackAssets: Asset[] = [
  {
    name: "Bitcoin",
    symbol: "BTC",
    buyPrice: 65000,
    sellPrice: 64500,
    decimals: 4,
    imageUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
  },
  {
    name: "Ethereum",
    symbol: "ETH",
    buyPrice: 3500,
    sellPrice: 3450,
    decimals: 4,
    imageUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
  },
  {
    name: "Solana",
    symbol: "SOL",
    buyPrice: 180,
    sellPrice: 178,
    decimals: 4,
    imageUrl: "https://cryptologos.cc/logos/solana-sol-logo.png",
  },
];

export async function getAssetDetails(): Promise<Asset[]> {
  try {
    const response = await axios.get(`${BASE_URL}/asset`);
    if (response.data && response.data.assets) {
      return response.data.assets;
    }
    return fallbackAssets;
  } catch (error) {
    console.error("Error fetching asset details:", error);
    return fallbackAssets;
  }
}
