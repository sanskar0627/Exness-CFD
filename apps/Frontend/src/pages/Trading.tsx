import { useEffect, useState } from "react";
import ChartComponent from "../components/Chart";
import { Channels, Duration } from "../utils/constants";
import type { SYMBOL } from "../utils/constants";
import AskBids from "../components/AskBidsTable";
import { findUserAmount } from "../api/trade";
import { useNavigate } from "react-router";
import OrdersPanel from "../components/OrdersPanel";
import BuySell from "../components/BuySell";
import { toDisplayPrice } from "../utils/utils";
import { fetchPlatformProfit, type PlatformProfitResponse } from "../api/profit";

export default function Trading() {
  const [duration, setDuration] = useState<Duration>(Duration.candles_1m);
  const [symbol, setSymbol] = useState<SYMBOL>(Channels.BTCUSDT);
  const [prices, setPrices] = useState({ askPrice: 0, bidPrice: 0 });
  const [platformProfit, setPlatformProfit] = useState<PlatformProfitResponse | null>(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    async function checkdata() {
      try {
        const data = await findUserAmount();
        // Check if user is authenticated (balance object exists)
        if (!data || !data.balance || data.error) {
          console.log("Authentication failed, redirecting to signin");
          localStorage.removeItem("token");
          localStorage.removeItem("userID");
          navigate("/signin");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("userID");
        navigate("/signin");
      }
    }

    checkdata();
  }, [navigate]);

  useEffect(() => {
    const loadPlatformProfit = async () => {
      try {
        const data = await fetchPlatformProfit();
        setPlatformProfit(data);
      } catch (error) {
        console.error("Failed to load platform profit:", error);
      }
    };

    loadPlatformProfit();
    const interval = setInterval(loadPlatformProfit, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 overflow-hidden flex flex-col font-mono">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-neutral-950">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-neutral-500/10 via-neutral-600/5 to-transparent blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-gradient-to-bl from-neutral-400/8 via-neutral-500/4 to-transparent blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-gradient-to-tr from-neutral-600/6 via-neutral-400/3 to-transparent blur-3xl"></div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(115,115,115,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(115,115,115,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      <div className="relative z-10 w-full h-full flex flex-col p-4">
        <div className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-600 p-4 rounded-lg mb-4 flex gap-4 overflow-x-auto">
          <button
            className={`px-4 py-2 rounded-md transition-all ${
              symbol === Channels.BTCUSDT
                ? "bg-[#158BF9]/10 text-[#158BF9] border border-[#158BF9]/30"
                : "text-neutral-50 hover:bg-neutral-800/50 border border-neutral-600/50"
            }`}
            disabled={symbol === Channels.BTCUSDT}
            onClick={() => setSymbol(Channels.BTCUSDT)}
          >
            <div className="flex items-center">
              <span className="font-medium text-sm">BTC/USDT</span>
              <span className="ml-2 text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded">
                +2.4%
              </span>
            </div>
          </button>

          <button
            className={`px-4 py-2 rounded-md transition-all ${
              symbol === Channels.ETHUSDT
                ? "bg-[#158BF9]/10 text-[#158BF9] border border-[#158BF9]/30"
                : "text-neutral-50 hover:bg-neutral-800/50 border border-neutral-600/50"
            }`}
            disabled={symbol === Channels.ETHUSDT}
            onClick={() => setSymbol(Channels.ETHUSDT)}
          >
            <div className="flex items-center">
              <span className="font-medium text-sm">ETH/USDT</span>
              <span className="ml-2 text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded">
                +1.9%
              </span>
            </div>
          </button>

          <button
            className={`px-4 py-2 rounded-md transition-all ${
              symbol === Channels.SOLUSDT
                ? "bg-[#158BF9]/10 text-[#158BF9] border border-[#158BF9]/30"
                : "text-neutral-50 hover:bg-neutral-800/50 border border-neutral-600/50"
            }`}
            disabled={symbol === Channels.SOLUSDT}
            onClick={() => setSymbol(Channels.SOLUSDT)}
          >
            <div className="flex items-center">
              <span className="font-medium text-sm">SOL/USDT</span>
              <span className="ml-2 text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded">
                -0.8%
              </span>
            </div>
          </button>
          <div className="flex items-center gap-2 ml-auto">
            {/* Platform Profit Display */}
            <div className="flex items-center bg-green-500/10 border border-green-500/30 px-4 py-2 rounded-md mr-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center bg-green-500/20 w-7 h-7 rounded">
                  <div className="w-2.5 h-2.5 bg-green-500"></div>
                </div>
                <div>
                  <div className="text-[9px] text-green-400/70 font-medium uppercase">Platform Profit</div>
                  <div className="text-sm font-bold text-green-400">
                    {platformProfit ? `$${platformProfit.totalProfit.toFixed(2)}` : "$0.00"}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-neutral-800/60 backdrop-blur-sm rounded-md p-1 flex border border-neutral-600">
              <button
                className={`px-3 py-2 rounded text-sm font-medium transition ${
                  duration === Duration.candles_1m
                    ? "bg-neutral-600 text-neutral-50"
                    : "text-neutral-300 hover:text-neutral-50"
                }`}
                disabled={duration === Duration.candles_1m}
                onClick={() => setDuration(Duration.candles_1m)}
              >
                1m
              </button>
              <button
                className={`px-3 py-2 rounded text-sm font-medium transition ${
                  duration === Duration.candles_1d
                    ? "bg-neutral-600 text-neutral-50"
                    : "text-neutral-300 hover:text-neutral-50"
                }`}
                disabled={duration === Duration.candles_1d}
                onClick={() => setDuration(Duration.candles_1d)}
              >
                1d
              </button>
              <button
                className={`px-3 py-2 rounded text-sm font-medium transition ${
                  duration === Duration.candles_1w
                    ? "bg-neutral-600 text-neutral-50"
                    : "text-neutral-300 hover:text-neutral-50"
                }`}
                disabled={duration === Duration.candles_1w}
                onClick={() => setDuration(Duration.candles_1w)}
              >
                1w
              </button>
            </div>
          </div>
        </div>

        <div className="flex-grow grid grid-cols-12 gap-4 h-[calc(100vh-120px)]">
          <div className="col-span-12 md:col-span-2 order-2 md:order-1 overflow-auto h-full">
            <div className="bg-neutral-900/80 backdrop-blur-xl rounded-lg border border-neutral-600 p-4 h-full">
              <h3 className="text-neutral-50 text-sm font-medium mb-4 flex justify-between items-center">
                <span>Market Data</span>
                <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded">Live</span>
              </h3>
              <AskBids symbol={symbol} />
            </div>
          </div>

          <div className="col-span-12 md:col-span-10 order-1 md:order-2 flex overflow-hidden h-[calc(100vh-130px)]">
            <div className="w-full h-full md:w-3/4 flex flex-col gap-4 pr-4">
              <div className="h-[65%] flex flex-col">
                <ChartComponent
                  symbol={symbol}
                  duration={duration}
                  onPriceUpdate={setPrices}
                />
              </div>

              <div className="h-[35%]">
                <OrdersPanel />
              </div>
            </div>

            <div className="w-full h-full md:w-1/4">
              <BuySell
                symbol={symbol}
                askPrice={toDisplayPrice(prices.askPrice)}
                bidPrice={toDisplayPrice(prices.bidPrice)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
