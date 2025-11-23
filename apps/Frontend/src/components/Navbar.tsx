import { useEffect, useState } from "react";
import { fetchPlatformProfit, type PlatformProfitResponse } from "../api/profit";

export default function Navbar() {
  const [platformProfit, setPlatformProfit] = useState<PlatformProfitResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlatformProfit = async () => {
      try {
        const data = await fetchPlatformProfit();
        setPlatformProfit(data);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load platform profit:", error);
        setLoading(false);
        // Set default values on error
        setPlatformProfit({
          totalProfit: 0,
          openTrades: 0,
          closedTrades: 0,
          totalTrades: 0,
          profitInCents: 0,
        });
      }
    };

    loadPlatformProfit();
    // Refresh every 30 seconds
    const interval = setInterval(loadPlatformProfit, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-600 py-4 px-6 sticky top-0 z-50 w-full">
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-neutral-500 flex items-center justify-center">
              <span className="text-neutral-50 font-bold text-sm">E</span>
            </div>
            <h1 className="text-xl font-bold text-neutral-50">Exness</h1>
          </div>
          <div className="hidden md:flex space-x-6 ml-8">
            <a href="/" className="text-neutral-400 hover:text-neutral-50 transition-colors">
              Home
            </a>
            <a href="/trading" className="text-neutral-400 hover:text-neutral-50 transition-colors">
              Trading
            </a>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-green-500/10 border border-green-500/30 px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center bg-green-500/20 w-8 h-8 rounded">
                <div className="w-3 h-3 bg-green-500"></div>
              </div>
              <div>
                <div className="text-[10px] text-green-400/70 font-medium uppercase">Profit</div>
                <div className="text-sm font-bold text-green-400">
                  {loading ? "..." : `$${platformProfit?.totalProfit.toFixed(2) || "0.00"}`}
                </div>
              </div>
            </div>
          </div>
          <button className="bg-neutral-500 hover:bg-neutral-400 text-neutral-50 px-4 py-2 rounded-md transition-colors text-sm font-medium">
            DEMO
          </button>
        </div>
      </div>
    </nav>
  );
}
