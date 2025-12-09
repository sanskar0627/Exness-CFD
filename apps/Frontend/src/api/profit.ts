import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v2";

export interface PlatformProfitResponse {
  totalProfit: number; // In USD
  openTrades: number;
  closedTrades: number;
  totalTrades: number;
  profitInCents: number;
}

export const fetchPlatformProfit = async (): Promise<PlatformProfitResponse> => {
  try {
    const response = await axios.get<PlatformProfitResponse>(
      `${API_BASE_URL}/trade/platform-profit`
    );
    return response.data;
  } catch (error) {
    console.error("[PLATFORM PROFIT] Failed to fetch:", error);
    throw error;
  }
};
