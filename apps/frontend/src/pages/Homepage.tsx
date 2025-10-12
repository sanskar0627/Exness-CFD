import { useEffect, useState } from "react";
import { findUserAmount } from "../api/trade";
import { toDisplayPriceUSD } from "../utils/utils";

export default function PersonalDashboard() {
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    async function checkAuthAndBalance() {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const data = await findUserAmount();
          if (data && data.usd_balance !== undefined) {
            setUserBalance(data.usd_balance); // Use cents for proper display
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.log("User not authenticated or error fetching balance");
        setIsAuthenticated(false);
      }
    }

    checkAuthAndBalance();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 overflow-hidden font-mono">
      <div className="fixed inset-0 bg-neutral-950">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-neutral-500/10 via-neutral-600/5 to-transparent blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-gradient-to-bl from-neutral-400/8 via-neutral-500/4 to-transparent blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-gradient-to-tr from-neutral-600/6 via-neutral-400/3 to-transparent blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(115,115,115,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(115,115,115,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>
      
      <nav className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#158BF9] to-[#0066CC] rounded-lg flex items-center justify-center">
            <span className="text-neutral-50 font-bold text-sm">E</span>
          </div>
          <span className="text-neutral-50 font-bold text-xl">Exness</span>
        </div>

        <div className="hidden md:flex items-center space-x-8">
          <a href="#" className="text-neutral-400 hover:text-neutral-50 transition-colors">Home</a>
          <a href="/trading" className="text-neutral-400 hover:text-neutral-50 transition-colors">Trading</a>
          {!isAuthenticated ? (
            <a href="/signin" className="text-neutral-400 hover:text-neutral-50 transition-colors">Login</a>
          ) : (
            <div className="flex items-center gap-3">
              <div className="bg-neutral-800/60 px-3 py-1 rounded-md border border-neutral-600/50">
                <span className="text-xs text-neutral-400">Balance:</span>
                <span className="text-sm text-green-400 font-medium ml-1">
                  ${userBalance ? toDisplayPriceUSD(userBalance).toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  }) : '0.00'}
                </span>
              </div>
              <button 
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("userID");
                  window.location.reload();
                }}
                className="text-neutral-400 hover:text-neutral-50 transition-colors text-sm"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        <button className="bg-gradient-to-r from-[#158BF9] to-[#0066CC] hover:from-[#0066CC] hover:to-[#158BF9] text-neutral-50 px-6 py-2 rounded-lg font-semibold transition-all">
          {isAuthenticated ? "LIVE TRADING" : "START DEMO"}
        </button>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center mb-6">
              <span className="text-neutral-400 text-sm">Professional Trading Platform</span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="text-neutral-50">Next-Gen</span>
              <br />
              <span className="bg-gradient-to-r from-[#158BF9] to-[#0066CC] bg-clip-text text-transparent">Trading</span>
            </h1>

            <p className="text-neutral-300 text-lg mb-8 max-w-lg">
              Experience professional-grade trading with real-time market data, advanced analytics, and institutional-level execution speed.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <button
                onClick={() => (window.location.href = "/trading")}
                className="bg-gradient-to-r from-[#158BF9] to-[#0066CC] hover:from-[#0066CC] hover:to-[#158BF9] text-white px-8 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                Start Trading →
              </button>
              <button className="border border-neutral-500 text-neutral-300 px-8 py-3 rounded-lg font-semibold hover:bg-neutral-800/50 hover:text-neutral-50 transition-all">
                ▶ View Demo
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-neutral-50 font-semibold">Trusted Platform</span>
              <div className="flex space-x-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-green-500 rounded-sm"></div>
                ))}
              </div>
              <span className="text-neutral-400">Secure & Regulated</span>
            </div>
          </div>

          <div className="relative">
            <div className="bg-neutral-900/90 backdrop-blur-sm border border-neutral-600/50 rounded-xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-neutral-50 text-xs font-bold">FX</span>
                  </div>
                  <span className="text-neutral-50 font-semibold">
                    {isAuthenticated ? "Live Account" : "Trading Overview"}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-neutral-50">
                    ${userBalance ? toDisplayPriceUSD(userBalance).toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    }) : '12,450.00'}
                  </div>
                  <div className="text-green-400 text-sm">
                    {isAuthenticated ? "Available Balance" : "+2.4% today"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-neutral-800/80 backdrop-blur-sm p-4 rounded-lg border border-neutral-600/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded"></div>
                    <span className="text-neutral-300 text-sm font-medium">ETH/USD</span>
                  </div>
                  <div className="text-neutral-50 font-bold text-lg">$3,876.45</div>
                  <div className="text-green-400 text-xs font-medium">+1.24%</div>
                </div>

                <div className="bg-neutral-800/80 backdrop-blur-sm p-4 rounded-lg border border-neutral-600/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-500 rounded"></div>
                    <span className="text-neutral-300 text-sm font-medium">BTC/USD</span>
                  </div>
                  <div className="text-neutral-50 font-bold text-lg">$67,234.12</div>
                  <div className="text-red-400 text-xs font-medium">-0.34%</div>
                </div>

                <div className="bg-neutral-800/80 backdrop-blur-sm p-4 rounded-lg border border-neutral-600/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded"></div>
                    <span className="text-neutral-300 text-sm font-medium">SOL/USD</span>
                  </div>
                  <div className="text-neutral-50 font-bold text-lg">$156.78</div>
                  <div className="text-green-400 text-xs font-medium">+2.67%</div>
                </div>

                <div className="bg-neutral-800/80 backdrop-blur-sm p-4 rounded-lg border border-neutral-600/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded"></div>
                    <span className="text-neutral-300 text-sm font-medium">EUR/USD</span>
                  </div>
                  <div className="text-neutral-50 font-bold text-lg">1.0892</div>
                  <div className="text-green-400 text-xs font-medium">+0.12%</div>
                </div>
              </div>

              <button
                onClick={() => (window.location.href = "/trading")}
                className="w-full bg-gradient-to-r from-[#158BF9] to-[#0066CC] hover:from-[#0066CC] hover:to-[#158BF9] text-white py-3 rounded-lg font-semibold transition-all shadow-md"
              >
                {isAuthenticated ? "Open Live Trading" : "Start Demo Trading"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
