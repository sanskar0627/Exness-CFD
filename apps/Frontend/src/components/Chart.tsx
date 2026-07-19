import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
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

// Binance-style palette
const UP_COLOR = "#0ECB81";
const DOWN_COLOR = "#F6465D";
const GRID_COLOR = "rgba(43, 49, 57, 0.6)";
const BORDER_COLOR = "#2B3139";
const TEXT_COLOR = "#B7BDC6";
const CROSSHAIR_COLOR = "#758696";

type Candle = CandlestickData<Time>;

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
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState<boolean>(true);
  const tooltipTimeoutRef = useRef<number | null>(null);
  const userScrolledRef = useRef<boolean>(false);
  const lastCandleTimeRef = useRef<number>(0);

  // Refs that mirror props/state so the realtime tick handler always sees the
  // CURRENT value without re-creating the whole chart (prevents stale closures
  // and unnecessary chart teardowns on parent re-renders).
  const followModeRef = useRef<boolean>(true);
  const onPriceUpdateRef = useRef(onPriceUpdate);

  useEffect(() => {
    followModeRef.current = followMode;
  }, [followMode]);

  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

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

    // requestAnimationFrame batching: no matter how many ticks arrive
    // (sub-20ms stream), we paint at most once per display frame.
    let pendingCandle: Candle | null = null;
    let rafId: number | null = null;

    // Legend state (updated via direct DOM writes — zero React re-renders)
    let latestCandle: Candle | null = null;
    let isHoveringLegend = false;

    // Single reusable timer for the "user scrolled, pause auto-follow" window
    let userScrollTimer: number | null = null;

    const container = chartContainerRef.current;

    const formatLegend = (c: Candle) => {
      const up = c.close >= c.open;
      const color = up ? UP_COLOR : DOWN_COLOR;
      const chg = c.open !== 0 ? ((c.close - c.open) / c.open) * 100 : 0;
      const f = (n: number) =>
        n.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      return (
        `<span style="color:${TEXT_COLOR}">O</span> <span style="color:${color}">${f(c.open)}</span> ` +
        `<span style="color:${TEXT_COLOR}">H</span> <span style="color:${color}">${f(c.high)}</span> ` +
        `<span style="color:${TEXT_COLOR}">L</span> <span style="color:${color}">${f(c.low)}</span> ` +
        `<span style="color:${TEXT_COLOR}">C</span> <span style="color:${color}">${f(c.close)}</span> ` +
        `<span style="color:${color}">${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%</span>`
      );
    };

    const updateLegend = (c: Candle | null) => {
      if (legendRef.current && c) {
        legendRef.current.innerHTML = formatLegend(c);
      }
    };

    const flushFrame = () => {
      rafId = null;
      if (isCleanedUp || !pendingCandle || !candlestickSeries) return;
      const candle = pendingCandle;
      pendingCandle = null;

      candlestickSeries.update(candle);
      latestCandle = candle;
      if (!isHoveringLegend) updateLegend(candle);

      // Follow Mode: auto-scroll on NEW candle only (same behavior as before,
      // but reads the live ref so toggling actually takes effect immediately)
      if (followModeRef.current && !userScrolledRef.current && chart) {
        if (candle.time !== lastCandleTimeRef.current) {
          lastCandleTimeRef.current = candle.time as number;
          chart.timeScale().scrollToRealTime();
        }
      }
    };

    const markUserInteraction = () => {
      if (!followModeRef.current) return;
      userScrolledRef.current = true;
      if (userScrollTimer) clearTimeout(userScrollTimer);
      userScrollTimer = window.setTimeout(() => {
        userScrolledRef.current = false;
      }, 3000);
    };

    const initChart = async () => {
      try {
        setLoading(true);
        setError(null);

        chart = createChart(container, {
          layout: {
            background: { type: ColorType.Solid, color: "#141D22" },
            textColor: TEXT_COLOR,
            fontSize: 11,
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            attributionLogo: false,
          },
          width: container.clientWidth,
          height: container.clientHeight,
          grid: {
            vertLines: { color: GRID_COLOR, style: LineStyle.Solid },
            horzLines: { color: GRID_COLOR, style: LineStyle.Solid },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: CROSSHAIR_COLOR,
              width: 1,
              style: LineStyle.Dashed,
              labelBackgroundColor: BORDER_COLOR,
            },
            horzLine: {
              color: CROSSHAIR_COLOR,
              width: 1,
              style: LineStyle.Dashed,
              labelBackgroundColor: BORDER_COLOR,
            },
          },
          rightPriceScale: {
            borderColor: BORDER_COLOR,
            scaleMargins: { top: 0.1, bottom: 0.08 },
            entireTextOnly: true,
          },
          timeScale: {
            borderColor: BORDER_COLOR,
            timeVisible: true,
            secondsVisible: false,
            barSpacing: 9,
            minBarSpacing: 1, // allow deep zoom-out like Binance
            rightOffset: 6,
          },
          // Smooth, momentum-based pan on both mouse and touch
          kineticScroll: { mouse: true, touch: true },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: false,
          },
          handleScale: {
            mouseWheel: true,
            pinch: true,
            axisPressedMouseMove: true,
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
          upColor: UP_COLOR,
          downColor: DOWN_COLOR,
          borderVisible: false,
          wickUpColor: UP_COLOR,
          wickDownColor: DOWN_COLOR,
          priceLineVisible: true,
          priceLineStyle: LineStyle.Dashed,
          priceLineWidth: 1,
          lastValueVisible: true,
        });

        const tickWrapper = (trade: Trade) => {
          if (isCleanedUp) return;

          // Guard: only process ticks for the chart's current symbol
          if (!trade.symbol || trade.symbol !== symbol) return;

          if (
            !trade.bidPrice ||
            !trade.askPrice ||
            isNaN(trade.bidPrice) ||
            isNaN(trade.askPrice)
          ) {
            return;
          }

          if (
            onPriceUpdateRef.current &&
            trade.bidPrice > 0 &&
            trade.askPrice > 0
          ) {
            onPriceUpdateRef.current({
              bidPrice: trade.bidPrice,
              askPrice: trade.askPrice,
            });
          }

          const tick: RealtimeUpdate = {
            symbol: trade.symbol,
            bidPrice: trade.bidPrice,
            askPrice: trade.askPrice,
            time: Math.floor(Date.now() / 1000),
          };

          const candle = processRealupdate(tick, duration);
          if (candle) {
            // Coalesce: keep only the newest candle state per animation frame
            pendingCandle = candle as Candle;
            if (rafId === null) {
              rafId = requestAnimationFrame(flushFrame);
            }
          }
        };

        const rawData = await getChartData(symbol, duration);
        if (isCleanedUp) return;

        if (candlestickSeries) {
          candlestickSeries.setData(rawData);
          if (rawData.length > 0) {
            latestCandle = rawData[rawData.length - 1] as Candle;
            updateLegend(latestCandle);
          }
        }

        if (chart) {
          // Initial zoom: show a sensible window of recent candles
          const dataLength = rawData.length;
          if (dataLength > 0) {
            let visibleCandles;
            switch (duration) {
              case Duration.candles_1m:
                visibleCandles = 60;
                break;
              case Duration.candles_1d:
                visibleCandles = 30;
                break;
              case Duration.candles_1w:
                visibleCandles = 20;
                break;
              default:
                visibleCandles = 60;
            }
            chart.timeScale().setVisibleLogicalRange({
              from: Math.max(0, dataLength - visibleCandles),
              to: dataLength - 1 + 6, // include right offset breathing room
            });
          } else {
            chart.timeScale().fitContent();
          }

          // OHLC legend follows the crosshair (direct DOM writes, no re-renders)
          chart.subscribeCrosshairMove((param) => {
            if (isCleanedUp || !candlestickSeries || !legendRef.current) return;
            if (param.time !== undefined) {
              const data = param.seriesData.get(candlestickSeries) as
                | Candle
                | undefined;
              if (data && "open" in data) {
                isHoveringLegend = true;
                updateLegend(data);
                return;
              }
            }
            isHoveringLegend = false;
            updateLegend(latestCandle);
          });
        }

        // Pause auto-follow only on REAL user input (wheel/drag/touch),
        // not on programmatic scrolls — kills the old feedback loop.
        container.addEventListener("wheel", markUserInteraction, {
          passive: true,
        });
        container.addEventListener("mousedown", markUserInteraction);
        container.addEventListener("touchstart", markUserInteraction, {
          passive: true,
        });

        const signalingManager = Signalingmanager.getInstance();
        unwatch = signalingManager.watch(symbol, tickWrapper);

        chartRef.current = chart;
        setLoading(false);
      } catch (err) {
        if (isCleanedUp) return;
        console.error("Failed to load chart data:", err);
        setError("Failed to load chart data. Please try again.");
        setLoading(false);
      }
    };

    // ResizeObserver: reacts to layout/panel changes too, and preserves the
    // user's zoom level (the old handler reset zoom with fitContent()).
    const resizeObserver = new ResizeObserver((entries) => {
      if (!chart || isCleanedUp) return;
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
        }
      }
    });
    resizeObserver.observe(container);

    initChart();

    return () => {
      isCleanedUp = true;

      if (unwatch) {
        unwatch();
        unwatch = null;
      }

      if (rafId !== null) cancelAnimationFrame(rafId);
      if (userScrollTimer) clearTimeout(userScrollTimer);

      resizeObserver.disconnect();
      container.removeEventListener("wheel", markUserInteraction);
      container.removeEventListener("mousedown", markUserInteraction);
      container.removeEventListener("touchstart", markUserInteraction);

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
  }, [duration, symbol]);

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
          {/* OHLC legend (Binance-style) — updated via direct DOM, no re-renders */}
          <div
            ref={legendRef}
            className="absolute top-2 left-3 z-20 text-[11px] font-mono tracking-tight pointer-events-none select-none"
          />
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
