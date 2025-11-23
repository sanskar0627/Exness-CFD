/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { convertoUsdPrice, toDisplayPrice } from "../utils/utils";
import type { SYMBOL } from "../utils/constants";
import type { Asset } from "../types/asset";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v2";
export async function getKlineData(
  asset: any,
  duration: any,
  startTime?: any,
  endTime?: string,
) {
  const currentTimeSec = Math.floor(Date.now() / 1000);

  const startTimestamp = startTime ? Number(startTime) : currentTimeSec - 3600;
  const endTimestamp = endTime ? Number(endTime) : currentTimeSec;

  const res = await axios.get(`${BASE_URL}/asset/candles`, {
    params: {
      asset,
      ts: duration,
      startTime: startTimestamp,
      endTime: endTimestamp,
    },
  });

  if (res.data && Array.isArray(res.data.candles)) {
    res.data.candles = res.data.candles.map((candle: any) => ({
      open: toDisplayPrice(candle.open),
      high: toDisplayPrice(candle.high),
      low: toDisplayPrice(candle.low),
      close: toDisplayPrice(candle.close),
      time: candle.timestamp,
      decimal: candle.decimal,
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
      return e.response?.data || { message: "Failed to create account" };
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
      return error.response?.data || error;
    }
  }
}

export async function findUserAmount() {
  try {
    const token = localStorage.getItem("token");

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
  }
}

export async function getopentrades(token: string) {
  try {
    const data = await axios.get(`${BASE_URL}/trade/open`, {
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
    const data = await axios.get(`${BASE_URL}/trade/history`, {
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
        OrderId: orderId,
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

    payload["margin"] = convertoUsdPrice(margin);

    if (tpEnabled) {
      payload.takeProfit = Number(tpPrice);
    }
    if (slEnabled) {
      payload.stopLoss = Number(slPrice);
    }
    console.log("Data sent ", payload);

    const { data } = await axios.post(`${BASE_URL}/trade/open`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true,
    });

    return data;
  } catch (e) {
    throw new Error((e as Error).message);
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
