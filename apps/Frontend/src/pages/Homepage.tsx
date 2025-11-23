import { useEffect, useState } from "react";
import { fetchPlatformProfit, type PlatformProfitResponse } from "../api/profit";

export default function PersonalDashboard() {
  const [platformProfit, setPlatformProfit] = useState<PlatformProfitResponse | null>(null);

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
    // Refresh every 30 seconds
    const interval = setInterval(loadPlatformProfit, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 overflow-hidden font-mono">
      {/* Background Effects - More subtle materialistic approach */}
      <div className="fixed inset-0 bg-neutral-950">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-neutral-500/10 via-neutral-600/5 to-transparent blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-gradient-to-bl from-neutral-400/8 via-neutral-500/4 to-transparent blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-gradient-to-tr from-neutral-600/6 via-neutral-400/3 to-transparent blur-3xl"></div>

        <div className="absolute top-0 right-0 w-full h-full">
          <div className="absolute top-1/4 right-1/4 w-1 h-96 bg-gradient-to-b from-neutral-500 via-neutral-600 to-transparent rotate-45 blur-sm"></div>
          <div className="absolute top-1/3 right-1/3 w-0.5 h-80 bg-gradient-to-b from-neutral-400 via-neutral-500 to-transparent rotate-45 blur-sm"></div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-neutral-500 flex items-center justify-center">
            <span className="text-neutral-50 font-bold text-sm">E</span>
          </div>
          <span className="text-neutral-50 font-bold text-xl">Exness</span>
        </div>

        <div className="hidden md:flex items-center space-x-8">
          <a
            href="#"
            className="text-neutral-400 hover:text-neutral-50 transition-colors"
          >
            Home
          </a>
          <a
            href="/trading"
            className="text-neutral-400 hover:text-neutral-50 transition-colors"
          >
            Trading
          </a>
          <a
            href="/signin"
            className="text-neutral-400 hover:text-neutral-50 transition-colors"
          >
            Login
          </a>
        </div>

        <button className="bg-neutral-500 hover:bg-neutral-400 text-neutral-50 px-6 py-2 transition-colors">
          DEMO
        </button>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center mb-6">
              <span className="text-neutral-400 text-sm">
                Trading platform reimagined
              </span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="text-neutral-50">Trading</span>
              <br />
              <span className="text-neutral-50">Dashboard</span>
            </h1>

            <p className="text-neutral-300 text-lg mb-8 max-w-lg">
              Experience next-generation trading with our comprehensive Exness
              platform. Real-time market data, advanced analytics, and intuitive
              portfolio management in one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <button
                onClick={() => (window.location.href = "/trading")}
                className="bg-neutral-50 text-neutral-950 px-8 py-3 font-semibold hover:bg-neutral-200 transition-colors"
              >
                Start Trading →
              </button>
              <button className="border border-neutral-500 text-neutral-500 px-8 py-3 font-semibold hover:bg-neutral-500 hover:text-neutral-50 transition-colors">
                ▶ View Demo
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-neutral-50 font-semibold">Trusted Platform</span>
              <div className="flex space-x-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 bg-green-500"
                  ></div>
                ))}
              </div>
              <span className="text-neutral-400">Secure trading</span>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="relative">
            <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-600 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-green-500 flex items-center justify-center">
                    <span className="text-neutral-50 text-xs">FX</span>
                  </div>
                  <span className="text-neutral-50 font-semibold">
                    Trading Overview
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-neutral-50">$12,450</div>
                  <div className="text-green-400 text-sm">+2.4% today</div>
                </div>
              </div>

              {/* Trading Cards */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-neutral-800/60 p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-blue-500"></div>
                    <span className="text-neutral-300 text-sm">ETH/USD</span>
                  </div>
                  <div className="text-neutral-50 font-semibold">1.0875</div>
                  <div className="text-green-400 text-xs">+0.12%</div>
                </div>

                <div className="bg-neutral-800/60 p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-yellow-500"></div>
                    <span className="text-neutral-300 text-sm">BTC/USD</span>
                  </div>
                  <div className="text-neutral-50 font-semibold">1.2654</div>
                  <div className="text-red-400 text-xs">-0.08%</div>
                </div>

                <div className="bg-neutral-800/60 p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-neutral-500"></div>
                    <span className="text-neutral-300 text-sm">SOL/USD</span>
                  </div>
                  <div className="text-neutral-50 font-semibold">$2,045</div>
                  <div className="text-green-400 text-xs">+0.34%</div>
                </div>
              </div>

              <button
                onClick={() => (window.location.href = "/trading")}
                className="w-full bg-neutral-500 hover:bg-neutral-400 text-neutral-50 py-3 font-semibold transition-colors"
              >
                Open Trade
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-neutral-500 mb-2">500+</div>
            <div className="text-neutral-400">Trading Instruments</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-neutral-500 mb-2">24/7</div>
            <div className="text-neutral-400">Market Access</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-neutral-500 mb-2">0.1s</div>
            <div className="text-neutral-400">Execution Speed</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-neutral-500 mb-2">$1M+</div>
            <div className="text-neutral-400">Daily Volume</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-neutral-500 mb-2">99.9%</div>
            <div className="text-neutral-400">Uptime</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-green-500 mb-2">
              {platformProfit ? `$${platformProfit.totalProfit.toFixed(2)}` : "$0.00"}
            </div>
            <div className="text-neutral-400">Platform Profit</div>
            <div className="text-xs text-neutral-500 mt-1">
              {platformProfit ? `${platformProfit.totalTrades} trades (${platformProfit.openTrades} open)` : "0 trades"}
            </div>
          </div>
        </div>
      </div>

      {/* Trusted By Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <p className="text-neutral-400">Powered by professional tools</p>
        </div>

        <div className="flex justify-center items-center space-x-12 opacity-50">
          <div className="text-neutral-500 font-bold text-xl">MT4</div>
          <div className="text-neutral-500 font-bold text-xl">MT5</div>
          <div className="text-neutral-500 font-bold text-xl">TradingView</div>
          <div className="text-neutral-500 font-bold text-xl">WebTerminal</div>
          <div className="text-neutral-500 font-bold text-xl">Mobile App</div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-neutral-50 mb-4">
            Our Exness Platform Handles
            <br />
            Millions of Trades Daily
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          {/* Real-time Market Data */}
          <div className="bg-gradient-to-br from-neutral-900/80 to-neutral-800/60 backdrop-blur-sm border border-neutral-600 p-8">
            <h3 className="text-2xl font-bold text-neutral-50 mb-4">
              Real-time Market Data
            </h3>
            <p className="text-neutral-300 mb-6">
              Stay ahead with lightning-fast market updates, live charts, and
              instant price feeds from global financial markets.
            </p>

            <div className="bg-neutral-950/60 p-4 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-500"></div>
                  <span className="text-neutral-50 text-sm">EUR/USD Live Chart</span>
                </div>
                <span className="text-green-400 text-sm">1.0875 +0.12%</span>
              </div>

              <div className="h-32 bg-gradient-to-t from-neutral-500/20 to-transparent border-b border-neutral-500/30 mb-4 relative">
                <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-r from-neutral-500/10 via-neutral-400/20 to-neutral-500/10"></div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-neutral-400">Spread</div>
                  <div className="text-neutral-50">0.6 pips</div>
                </div>
                <div className="text-center">
                  <div className="text-neutral-400">Volume</div>
                  <div className="text-neutral-50">1.2M</div>
                </div>
                <div className="text-center">
                  <div className="text-neutral-400">High</div>
                  <div className="text-neutral-50">1.0892</div>
                </div>
                <div className="text-center">
                  <div className="text-neutral-400">Low</div>
                  <div className="text-neutral-50">1.0843</div>
                </div>
              </div>
            </div>
          </div>
          {/* Performance Analytics */}
          <div className="bg-gradient-to-br from-neutral-900/80 to-neutral-800/60 backdrop-blur-sm border border-neutral-600 p-8">
            <h3 className="text-2xl font-bold text-neutral-50 mb-4">
              Performance Analytics
            </h3>
            <p className="text-neutral-300 mb-6">
              Track your trading performance with comprehensive analytics and
              detailed reporting tools.
            </p>

            <div className="bg-neutral-950/60 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-blue-500"></div>
                  <span className="text-neutral-50 text-sm">
                    Monthly Performance
                  </span>
                </div>
                <div className="text-green-400 text-sm">
                  Jan Feb Mar Apr May
                </div>
              </div>

              <div className="h-40 relative bg-gradient-to-t from-neutral-500/10 to-transparent">
                <div className="absolute inset-0 flex items-end justify-around">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div
                        className={`w-2 ${
                          Math.random() > 0.3 ? "bg-neutral-500" : "bg-neutral-600"
                        }`}
                        style={{ height: `${Math.random() * 80 + 20}px` }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between text-xs text-neutral-400 mt-2">
                <span>Jan</span>
                <span>Mar</span>
                <span>May</span>
                <span>Dec</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Trading Instruments */}
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <span className="text-neutral-400 text-sm">Trading Platform</span>
            <div className="ml-4 w-8 h-4 bg-neutral-600 flex items-center px-1">
              <div className="w-3 h-3 bg-neutral-50"></div>
            </div>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-neutral-50 mb-8">
            Built with Professional Trading Technology
          </h2>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-6">
          <div className="flex items-center space-x-2 bg-neutral-800/60 px-4 py-2">
            <div className="w-6 h-4 bg-blue-500"></div>
            <span className="text-neutral-50 text-sm">MetaTrader 4</span>
          </div>
          <div className="flex items-center space-x-2 bg-neutral-800/60 px-4 py-2">
            <div className="w-6 h-4 bg-cyan-500"></div>
            <span className="text-neutral-50 text-sm">MetaTrader 5</span>
          </div>
          <div className="flex items-center space-x-2 bg-neutral-800/60 px-4 py-2">
            <div className="w-6 h-4 bg-yellow-500"></div>
            <span className="text-neutral-50 text-sm">TradingView</span>
          </div>
          <div className="flex items-center space-x-2 bg-neutral-800/60 px-4 py-2">
            <div className="w-6 h-4 bg-green-500"></div>
            <span className="text-neutral-50 text-sm">WebTerminal</span>
          </div>
          <div className="flex items-center space-x-2 bg-neutral-800/60 px-4 py-2">
            <div className="w-6 h-4 bg-red-500"></div>
            <span className="text-neutral-50 text-sm">Mobile Apps</span>
          </div>
          <div className="flex items-center space-x-2 bg-neutral-800/60 px-4 py-2">
            <div className="w-6 h-4 bg-neutral-500"></div>
            <span className="text-neutral-50 text-sm">API Trading</span>
          </div>
          <div className="flex items-center space-x-2 bg-neutral-800/60 px-4 py-2">
            <div className="w-6 h-4 bg-orange-500"></div>
            <span className="text-neutral-50 text-sm">Copy Trading</span>
          </div>
          <div className="flex items-center space-x-2 bg-neutral-800/60 px-4 py-2">
            <div className="w-6 h-4 bg-neutral-700"></div>
            <span className="text-neutral-50 text-sm">VPS Hosting</span>
          </div>
        </div>
      </div>

      {/* Why This Project Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="mb-16">
          <h2 className="text-4xl font-bold text-neutral-50 mb-4">
            Why Choose Exness?
          </h2>
          <p className="text-neutral-400 max-w-2xl">
            Our Exness platform represents the next generation of online trading
            with cutting-edge technology and user-focused design.
          </p>
        </div>

        <div className="space-y-12">
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-neutral-500 flex items-center justify-center">
              <span className="text-neutral-50 font-bold">01</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-neutral-50 mb-4">
                Ultra-Fast Execution
              </h3>
              <p className="text-neutral-400 max-w-2xl">
                Experience lightning-fast trade execution with our advanced
                technology infrastructure. Orders are processed in milliseconds
                with minimal slippage.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-neutral-500 flex items-center justify-center">
              <span className="text-neutral-50 font-bold">02</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-neutral-50 mb-4">
                Comprehensive Market Access
              </h3>
              <p className="text-neutral-400 max-w-2xl">
                Trade across multiple asset classes including forex,
                commodities, indices, and cryptocurrencies. Over 500 instruments
                available 24/7.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-neutral-500 flex items-center justify-center">
              <span className="text-neutral-50 font-bold">03</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-neutral-50 mb-4">
                Advanced Analytics
              </h3>
              <p className="text-neutral-400 max-w-2xl">
                Make informed decisions with our comprehensive analytics suite,
                real-time charts, and professional-grade trading tools powered
                by TradingView.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-neutral-500 flex items-center justify-center">
              <span className="text-neutral-50 font-bold">04</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-neutral-50 mb-4">
                Security & Reliability
              </h3>
              <p className="text-neutral-400 max-w-2xl">
                Your funds and data are protected with bank-grade security
                measures, regulated operations, and 99.9% uptime guarantee for
                uninterrupted trading.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}