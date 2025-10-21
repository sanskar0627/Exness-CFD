import { useEffect, useState } from "react";
import ChartComponent from "../components/Chart";
import { Channels, Duration } from "../utils/constants";
import type { SYMBOL } from "../utils/constants";
import AskBids from "../components/AskBidsTable";
import { findUserAmount } from "../api/trade";
import { useNavigate } from "react-router";
import OrdersPanel from "../components/OrdersPanel";
import BuySell from "../components/BuySell";
import { toDisplayPrice, toDisplayPriceUSD } from "../utils/utils";

export default function Trading() {
  const [duration, setDuration] = useState<Duration>(Duration.candles_1m);
  const [symbol, setSymbol] = useState<SYMBOL>(Channels.BTCUSDT);
  const [prices, setPrices] = useState({ askPrice: 0, bidPrice: 0 });
  const [userBalance, setUserBalance] = useState<number>(0);
  const navigate = useNavigate();

  // Reset prices when symbol changes to avoid showing stale prices
  useEffect(() => {
    console.log(`📊 Trading page - Symbol changed to: ${symbol}, resetting prices`);
    setPrices({ askPrice: 0, bidPrice: 0 });
  }, [symbol]);

  // Log price updates
  useEffect(() => {
    if (prices.askPrice > 0 || prices.bidPrice > 0) {
      console.log(`💹 Price update for ${symbol} - Ask: ${prices.askPrice}, Bid: ${prices.bidPrice}`);
    }
  }, [prices, symbol]);
  
  useEffect(() => {
    async function checkdata() {
      try {
        const data = await findUserAmount();
        
        // Check if we got an error response or invalid data
        if (!data || data.message || data.usd_balance === undefined || data.usd_balance === null) {
          console.log("Authentication failed or invalid response:", data);
          localStorage.removeItem("token");
          localStorage.removeItem("userID");
          navigate("/signin");
        } else {
          // Set user balance in cents for proper display with toDisplayPriceUSD
          console.log(`💰 Trading page - Balance received: ${data.usd_balance} cents = $${(data.usd_balance / 100).toFixed(2)}`);
          console.log(`💰 Will display as: $${toDisplayPriceUSD(data.usd_balance).toFixed(2)}`);
          setUserBalance(data.usd_balance);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("userID");
        navigate("/signin");
      }
    }

    checkdata();
    
    // Refresh balance every 10 seconds
    const balanceInterval = setInterval(checkdata, 10000);
    return () => clearInterval(balanceInterval);
  }, [navigate]);

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
        {/* Professional Trading Header with Balance */}
        <div className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-600/50 rounded-lg mb-4 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#158BF9] to-[#0066CC] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">E</span>
                </div>
                <h1 className="text-xl font-bold text-neutral-50">Exness Trading</h1>
              </div>
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-neutral-800/60 backdrop-blur-sm rounded-md border border-neutral-600/50">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-neutral-300">Live Market Data</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Account Balance Display */}
              <div className="bg-gradient-to-r from-neutral-800/80 to-neutral-700/60 backdrop-blur-sm rounded-lg px-4 py-3 border border-neutral-600/30">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-neutral-400 font-medium">Account Balance</span>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-green-400">
                        ${toDisplayPriceUSD(userBalance).toLocaleString('en-US', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </span>
                      <span className="text-xs text-neutral-400">USD</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Quick Account Actions */}
              <div className="flex items-center gap-2">
                <button className="px-3 py-2 bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-600/50 rounded-md text-sm text-neutral-300 hover:text-neutral-50 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                </button>
                <button 
                  onClick={() => navigate("/")}
                  className="px-3 py-2 bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-600/50 rounded-md text-sm text-neutral-300 hover:text-neutral-50 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

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
                key={symbol} // Force remount when symbol changes
                symbol={symbol}
                buyPrice={prices.askPrice}
                sellPrice={prices.bidPrice}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
