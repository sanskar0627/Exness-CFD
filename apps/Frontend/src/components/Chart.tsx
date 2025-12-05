import {
  createChart,
  ColorType,
  CandlestickSeries,
  type IChartApi,
  type CandlestickData,
  type CandlestickSeriesOptions,
  type CandlestickStyleOptions,
  type DeepPartial,
  type ISeriesApi,
  type SeriesOptionsCommon,
  type Time,
  type WhitespaceData,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import type { SYMBOL } from "../utils/constants";
import { Duration } from "../utils/constants";
import { Signalingmanager } from "../utils/subscription_manager";
import {
  getChartData,
  processRealupdate,
  resetLastCandle,
  type RealtimeUpdate,
} from "../utils/chart_agg_ws_api";
import type { Trade } from "./AskBidsTable";

export default function ChartComponent({
  duration,
  symbol,
  onPriceUpdate,
}: {
  duration: Duration;
  symbol: SYMBOL;
  onPriceUpdate?: (prices: { bidPrice: number; askPrice: number }) => void;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState<boolean>(true);
  const tooltipTimeoutRef = useRef<number | null>(null);
  const userScrolledRef = useRef<boolean>(false);
  const lastCandleTimeRef = useRef<number>(0);

  useEffect(() => {
    // Symbol changed - component will re-render with new chart
  }, [symbol]);

  useEffect(() => {
    if (tooltip) {
      setTooltipVisible(true);
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      tooltipTimeoutRef.current = window.setTimeout(() => {
        setTooltipVisible(false);
        setTooltip(null);
      }, 1500);
    }
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, [tooltip]);

  useEffect(() => {
    if (!chartContainerRef.current || !symbol) return;

    // Creating new chart for symbol and duration

    let candlestickSeries: ISeriesApi<
      "Candlestick",
      Time,
      CandlestickData<Time> | WhitespaceData<Time>,
      CandlestickSeriesOptions,
      DeepPartial<CandlestickStyleOptions & SeriesOptionsCommon>
    > | null = null;
    let chart: IChartApi | null = null;
    let unwatch: (() => void) | null = null;
    let isCleanedUp = false;

    const initChart = async () => {
      try {
        setLoading(true);
        setError(null);

        chart = createChart(chartContainerRef.current!, {
          layout: {
            background: {
              type: ColorType.VerticalGradient,
              topColor: "#141D22",
              bottomColor: "#141D22",
            },
            textColor: "#FFFFFF",
          },
          width: chartContainerRef.current!.clientWidth,
          height: chartContainerRef.current!.clientHeight,
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            // Increase bar spacing for bigger candles
            barSpacing: 12,  // Default is 6, higher = wider candles
            minBarSpacing: 8,  // Minimum spacing when zoomed out
            // Prevent excessive zoom out
            rightOffset: 12,  // Space on right side for latest candle
          },
          localization: {
            timeFormatter: (timestamp: any) => {
              const date = new Date(timestamp * 1000);
              const hours = date.getHours().toString().padStart(2, "0");
              const minutes = date.getMinutes().toString().padStart(2, "0");
              return `${hours}:${minutes}`;
            },
          },
        });

        candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#158BF9",
          downColor: "#EB483F",
          borderVisible: false,
          wickUpColor: "#158BF9",
          wickDownColor: "#EB483F",
        });

        const tickWrapper = (trade: Trade) => {
          // Check if component has been cleaned up
          if (isCleanedUp) {
            return;
          }

          // CRITICAL: Check if this trade is for the current symbol FIRST
          // This prevents BTC prices from showing on ETH/SOL charts during symbol switches
          if (!trade.symbol || trade.symbol !== symbol) {
            return;
          }

          // Check for valid price data
          if (!trade.bidPrice || !trade.askPrice || isNaN(trade.bidPrice) || isNaN(trade.askPrice)) {
            console.warn(`[CHART] Invalid price data for ${symbol}:`, trade);
            return;
          }

          // Only update prices AFTER confirming correct symbol
          const prices = {
            bidPrice: trade.bidPrice || 0,
            askPrice: trade.askPrice || 0,
          };
          if (onPriceUpdate && prices.bidPrice > 0 && prices.askPrice > 0) {
            onPriceUpdate(prices);
          }

          const tick: RealtimeUpdate = {
            symbol: trade.symbol,
            bidPrice: trade.bidPrice,
            askPrice: trade.askPrice,
            time: Math.floor(Date.now() / 1000),
          };

          const candle = processRealupdate(tick, duration);

          if (candle && candlestickSeries) {
            candlestickSeries.update(candle);
            
            // Auto-scroll to latest candle if Follow Mode is enabled
            if (followMode && !userScrolledRef.current && chart) {
              // Only scroll if this is a new candle (time changed)
              if (candle.time !== lastCandleTimeRef.current) {
                lastCandleTimeRef.current = candle.time as number;
                // Scroll to show the latest candle with some padding
                setTimeout(() => {
                  if (chart) {
                    chart.timeScale().scrollToRealTime();
                  }
                }, 50);
              }
            }
          } else {
            console.warn(`[CHART] Failed to update candle - candle:`, candle, 'series:', !!candlestickSeries);
          }
        };

        const rawData = await getChartData(symbol, duration);

        // Check if component was cleaned up during async operation
        if (isCleanedUp) return;

        if (candlestickSeries) {
          // CRITICAL FIX: Clear old symbol data first to prevent flash
          candlestickSeries.setData([]);
          // Then set new symbol data
          candlestickSeries.setData(rawData);
        }
        if (chart) {
          // Set intelligent initial zoom based on duration
          // Instead of fitContent() which shows ALL data (making candles tiny),
          // we show a reasonable number of recent candles for better visibility
          const dataLength = rawData.length;
          if (dataLength > 0) {
            // Determine how many candles to show based on chart duration
            let visibleCandles;
            switch (duration) {
              case Duration.candles_1m:
                visibleCandles = 60;  // Show last 1 hour (60 minutes)
                break;
              case Duration.candles_1d:
                visibleCandles = 30;  // Show last 30 days
                break;
              case Duration.candles_1w:
                visibleCandles = 20;  // Show last 20 weeks (~5 months)
                break;
              default:
                visibleCandles = 60;
            }

            // Set visible range to show only the most recent candles
            const from = Math.max(0, dataLength - visibleCandles);
            const to = dataLength - 1;
            
            chart.timeScale().setVisibleLogicalRange({
              from: from,
              to: to,
            });
            
            console.log(`[CHART] Initial zoom: showing ${visibleCandles} most recent candles (${from} to ${to} of ${dataLength})`);
          } else {
            // Fallback if no data
            chart.timeScale().fitContent();
          }
          
          // Track user scrolling to disable auto-scroll temporarily
          chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
            if (!followMode) return;
            
            // Mark that user has scrolled
            userScrolledRef.current = true;
            
            // Reset after 3 seconds of no scrolling
            setTimeout(() => {
              userScrolledRef.current = false;
            }, 3000);
          });
        }

        const signalingManager = Signalingmanager.getInstance();
        unwatch = signalingManager.watch(symbol, tickWrapper);

        chartRef.current = chart;
        setLoading(false);
      } catch (err) {
        // Check if component was cleaned up during async operation
        if (isCleanedUp) return;

        console.error("Failed to load chart data:", err);
        setError("Failed to load chart data. Please try again.");
        setLoading(false);
      }
    };

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        const parent = chartContainerRef.current;
        chart.applyOptions({
          width: parent.clientWidth,
          height: parent.clientHeight,
        });
        chart.timeScale().fitContent();
      }
    };

    initChart();

    setTimeout(handleResize, 100);

    window.addEventListener("resize", handleResize);

    return () => {
      // Mark as cleaned up IMMEDIATELY to stop all callbacks
      isCleanedUp = true;

      // IMPORTANT: Unsubscribe FIRST to prevent stale data
      if (unwatch) {
        unwatch();
        unwatch = null;
      }

      window.removeEventListener("resize", handleResize);

      resetLastCandle(symbol, duration);

      if (chart) {
        chart.remove();
        chart = null;
      }

      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }

      candlestickSeries = null;
    };
  }, [duration, symbol, onPriceUpdate]);

  return (
    <div className="text-neutral-50 h-full w-full relative">
      {tooltipVisible && tooltip && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-neutral-900/90 backdrop-blur-sm border border-neutral-600 rounded-md text-sm shadow-lg transition-opacity">
          {tooltip}
        </div>
      )}
      <div className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-600 rounded-lg overflow-hidden h-full w-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-600/40">
          <div>
            <h2 className="text-lg font-semibold text-neutral-50">{symbol}</h2>
            <div className="text-sm text-neutral-400">
              {duration === Duration.candles_1m && "1 Minute Chart"}
              {duration === Duration.candles_1d && "Daily Chart"}
              {duration === Duration.candles_1w && "Weekly Chart"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setFollowMode(!followMode);
                setTooltip(followMode ? "Follow Mode: OFF" : "Follow Mode: ON");
                if (!followMode && chartRef.current) {
                  // When enabling follow mode, scroll to latest
                  chartRef.current.timeScale().scrollToRealTime();
                }
              }}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${
                followMode
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-neutral-700/50 text-neutral-400 border border-neutral-600"
              }`}
              title={followMode ? "Auto-scroll enabled" : "Auto-scroll disabled"}
            >
              <div className="flex items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {followMode ? (
                    <>
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </>
                  ) : (
                    <>
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </>
                  )}
                </svg>
                <span>{followMode ? "Live" : "Paused"}</span>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-neutral-600 rounded-md bg-neutral-800/60 backdrop-blur-sm">
              <button
                className="p-2 rounded-l-md hover:bg-neutral-700/50 transition-colors text-neutral-300 hover:text-neutral-50"
                onClick={() => {
                  if (chartRef.current) {
                    const logicalRange = chartRef.current
                      .timeScale()
                      .getVisibleLogicalRange();
                    if (logicalRange !== null) {
                      const newRange = {
                        from:
                          logicalRange.from +
                          (logicalRange.to - logicalRange.from) * 0.2,
                        to:
                          logicalRange.to -
                          (logicalRange.to - logicalRange.from) * 0.2,
                      };
                      chartRef.current
                        .timeScale()
                        .setVisibleLogicalRange(newRange);
                      setTooltip("Zoomed in");
                    }
                  }
                }}
                title="Zoom In"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <div className="w-[1px] h-8 bg-neutral-600"></div>
              <button
                className="p-2 hover:bg-neutral-700/50 transition-colors text-neutral-300 hover:text-neutral-50"
                onClick={() => {
                  if (chartRef.current) {
                    const logicalRange = chartRef.current
                      .timeScale()
                      .getVisibleLogicalRange();
                    if (logicalRange !== null) {
                      const rangeSize = logicalRange.to - logicalRange.from;
                      const newRange = {
                        from: logicalRange.from - rangeSize * 0.2,
                        to: logicalRange.to + rangeSize * 0.2,
                      };
                      chartRef.current
                        .timeScale()
                        .setVisibleLogicalRange(newRange);
                      setTooltip("Zoomed out");
                    }
                  }
                }}
                title="Zoom Out"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <div className="w-[1px] h-8 bg-neutral-600"></div>
              <button
                className="p-2 rounded-r-md hover:bg-neutral-700/50 transition-colors text-neutral-300 hover:text-neutral-50"
                onClick={() => {
                  if (chartRef.current) {
                    chartRef.current.timeScale().fitContent();
                    setTooltip("Reset zoom");
                  }
                }}
                title="Reset Zoom"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </button>
            </div>
            <button className="p-2 rounded-md hover:bg-neutral-700/50 transition-colors text-neutral-300 hover:text-neutral-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-grow relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-neutral-600 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-sm text-neutral-400">Loading chart data...</p>
              </div>
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm z-10">
              <div className="flex flex-col items-center gap-3 p-6 bg-neutral-800 border border-red-500/30 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-red-500"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p className="text-red-400 font-medium">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-100 rounded-md transition-colors"
                >
                  Reload Page
                </button>
              </div>
            </div>
          )}
          <div ref={chartContainerRef} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}
