import { useEffect, useMemo, useState, useCallback } from "react";
import { closetrade, getclosedtrades, getopentrades, partialCloseTrade, addMarginToTrade } from "../api/trade";
import {
  calculatePnlCents,
  toDisplayPrice,
  toDisplayPriceUSD,
} from "../utils/utils";
import { subscribePrices, type LivePrices } from "../utils/price_store";

interface OpenOrder {
  orderId: string;
  type: "buy" | "sell";
  margin: number;
  leverage: number;
  openPrice: number;
  asset?: string;
  takeProfit?: number;
  stopLoss?: number;
  liquidationPrice?: number;
}

interface ClosedOrder extends OpenOrder {
  closePrice: number;
  pnl: number;
}

type OpenOrderWithPnl = OpenOrder & { pnlUsd: number };

export default function OrdersPanel({ onRefreshReady }: { onRefreshReady?: (refresh: () => void) => void }) {
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [closedOrders, setClosedOrders] = useState<ClosedOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isClosingPosition, setIsClosingPosition] = useState<string | null>(
    null
  );
  const [showPartialCloseModal, setShowPartialCloseModal] = useState<string | null>(null);
  const [showAddMarginModal, setShowAddMarginModal] = useState<string | null>(null);
  const [partialClosePercentage, setPartialClosePercentage] = useState<string>("50");
  const [additionalMargin, setAdditionalMargin] = useState<string>("100");
  const [latestPrices, setLatestPrices] = useState<LivePrices>({
    BTC: { bid: 0, ask: 0 },
    ETH: { bid: 0, ask: 0 },
    SOL: { bid: 0, ask: 0 },
  });

  const fetchOpenOrders = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const token = localStorage.getItem("token") || "";

      const response = await getopentrades(token);
      if (response?.data?.orders) {
        setOpenOrders(response.data.orders);
      } else {
        setOpenOrders([]);
      }
    } catch (error) {
      console.error("Error fetching open orders:", error);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  const fetchClosedOrders = async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const token = localStorage.getItem("token") || "";

      const response = await getclosedtrades(token);
      setClosedOrders(response.data.orders || []);
    } catch (error) {
      console.error("Error fetching closed orders:", error);
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "open") {
      fetchOpenOrders();
    } else {
      fetchClosedOrders();
    }

    // Set up polling to refresh data
    const intervalId = setInterval(() => {
      if (activeTab === "open") {
        fetchOpenOrders(true);
      } else {
        fetchClosedOrders(true);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeTab, fetchOpenOrders]);

  // Expose refresh function to parent
  useEffect(() => {
    if (onRefreshReady) {
      onRefreshReady(fetchOpenOrders);
    }
  }, [onRefreshReady, fetchOpenOrders]);

  useEffect(() => {
    const unsubscribe = subscribePrices((p: LivePrices) => {
      setLatestPrices(p);
    });
    return () => unsubscribe();
  }, []);

  const openWithPnl: OpenOrderWithPnl[] = useMemo(() => {
    return openOrders.map((o): OpenOrderWithPnl => {
      const sym = (o.asset || "BTC").replace("USDT", "");
      const p = latestPrices[sym as keyof LivePrices];
      if (!p || p.bid === 0 || p.ask === 0) {
        return { ...o, pnlUsd: 0 };
      }

      const currentcloseprice = o.type === "buy" ? p.bid : p.ask;
      // Dynamic P&L based on side: buy uses current buyPrice; sell uses current sellPrice
      const pnlInCents = calculatePnlCents({
        side: o.type,
        openPrice: o.openPrice,
        closePrice: currentcloseprice,
        marginCents: o.margin,
        leverage: o.leverage,
      });
      return { ...o, pnlUsd: pnlInCents };
    });
  }, [openOrders, latestPrices]);

  // Helper function to get TP/SL status
  const getTpSlStatus = (order: OpenOrderWithPnl) => {
    const sym = (order.asset || "BTC").replace("USDT", "");
    const p = latestPrices[sym as keyof LivePrices];
    if (!p) return { tpStatus: "none", slStatus: "none" };

    const currentPrice = order.type === "buy" ? p.bid : p.ask;

    let tpStatus = "none";
    let slStatus = "none";

    if (order.takeProfit) {
      if (order.type === "buy" && currentPrice >= order.takeProfit) {
        tpStatus = "hit";
      } else if (order.type === "sell" && currentPrice <= order.takeProfit) {
        tpStatus = "hit";
      } else {
        const distance =
          Math.abs(currentPrice - order.takeProfit) / order.takeProfit;
        tpStatus = distance < 0.02 ? "close" : "active";
      }
    }

    if (order.stopLoss) {
      if (order.type === "buy" && currentPrice <= order.stopLoss) {
        slStatus = "hit";
      } else if (order.type === "sell" && currentPrice >= order.stopLoss) {
        slStatus = "hit";
      } else {
        const distance =
          Math.abs(currentPrice - order.stopLoss) / order.stopLoss;
        slStatus = distance < 0.02 ? "close" : "active";
      }
    }

    return { tpStatus, slStatus };
  };

  const closePosition = async (orderId: string) => {
    try {
      setIsClosingPosition(orderId);
      const token = localStorage.getItem("token") || "";

      await closetrade(token, orderId);

      fetchOpenOrders();
      fetchClosedOrders();
    } catch (error) {
      console.error("Error closing position:", error);
    } finally {
      setIsClosingPosition(null);
    }
  };

  const handlePartialClose = async (orderId: string) => {
    try {
      setIsClosingPosition(orderId);
      const token = localStorage.getItem("token") || "";

      const percentage = parseFloat(partialClosePercentage);
      if (isNaN(percentage) || percentage < 1 || percentage > 99) {
        alert("Please enter a valid percentage between 1 and 99");
        setIsClosingPosition(null);
        return;
      }

      await partialCloseTrade(orderId, percentage, token);

      setShowPartialCloseModal(null);
      setPartialClosePercentage("50"); // Reset to default
      fetchOpenOrders();
      fetchClosedOrders();
    } catch (error) {
      console.error("Error partial closing position:", error);
      alert("Failed to partial close position: " + (error as Error).message);
    } finally {
      setIsClosingPosition(null);
    }
  };

  const handleAddMargin = async (orderId: string) => {
    try {
      setIsClosingPosition(orderId);
      const token = localStorage.getItem("token") || "";

      const margin = parseFloat(additionalMargin);
      if (isNaN(margin) || margin < 10) {
        alert("Please enter a valid amount (minimum $10)");
        setIsClosingPosition(null);
        return;
      }

      await addMarginToTrade(orderId, margin, token);

      setShowAddMarginModal(null);
      setAdditionalMargin("100"); // Reset to default
      fetchOpenOrders();
    } catch (error) {
      console.error("Error adding margin:", error);
      alert("Failed to add margin: " + (error as Error).message);
    } finally {
      setIsClosingPosition(null);
    }
  };

  return (
    <div className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-600 rounded-lg w-full h-full flex flex-col">
      <div className="flex border-b border-neutral-600/40">
        <button
          className={`flex-1 py-3 text-center text-sm font-medium transition ${
            activeTab === "open"
              ? "text-[#158BF9] border-b-2 border-[#158BF9]"
              : "text-neutral-300 hover:text-neutral-50"
          }`}
          onClick={() => setActiveTab("open")}
        >
          Open Positions
        </button>
        <button
          className={`flex-1 py-3 text-center text-sm font-medium transition ${
            activeTab === "closed"
              ? "text-[#158BF9] border-b-2 border-[#158BF9]"
              : "text-neutral-300 hover:text-neutral-50"
          }`}
          onClick={() => setActiveTab("closed")}
        >
          Order History
        </button>
      </div>

      <div className="p-4 overflow-auto flex-1">
        {isLoading ? (
          <div className="text-center py-8 text-neutral-400">Loading...</div>
        ) : activeTab === "open" ? (
          <>
            {/* Status Legend */}
            <div className="mb-4 p-3 bg-neutral-800/60 backdrop-blur-sm border border-neutral-600 rounded-md">
              <div className="flex items-center gap-6 text-sm text-neutral-400">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>TP/SL Hit</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500 animate-pulse">!</span>
                  <span>Close to TP/SL</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-500 animate-pulse">!</span>
                  <span>Near Liquidation</span>
                </div>
              </div>
            </div>
            {openWithPnl.length > 0 ? (
              <div className="overflow-x-auto h-full">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-neutral-900/80 backdrop-blur-sm z-10">
                    <tr className="text-xs text-neutral-400 border-b border-neutral-600/40">
                      <th className="py-3 px-3 text-left font-medium w-12">#</th>
                      <th className="py-3 px-3 text-left font-medium">Symbol</th>
                      <th className="py-3 px-3 text-right font-medium">Type</th>
                      <th className="py-3 px-3 text-right font-medium">Margin</th>
                      <th className="py-3 px-3 text-right font-medium">Leverage</th>
                      <th className="py-3 px-3 text-right font-medium">Open Price</th>
                      <th className="py-3 px-3 text-right font-medium">Take Profit</th>
                      <th className="py-3 px-3 text-right font-medium">Stop Loss</th>
                      <th className="py-3 px-3 text-right font-medium">Liquidation</th>
                      <th className="py-3 px-3 text-right font-medium">Unreal. P&L</th>
                      <th className="py-3 px-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openWithPnl.map((order, index) => {
                      const { tpStatus, slStatus } = getTpSlStatus(order);
                      const sym = (order.asset || "BTC").replace("USDT", "");
                      const p = latestPrices[sym as keyof LivePrices];
                      const currentPrice = p
                        ? order.type === "buy"
                          ? p.bid
                          : p.ask
                        : 0;
                      const liquidationDistance = order.liquidationPrice
                        ? Math.abs(currentPrice - order.liquidationPrice) /
                          order.liquidationPrice
                        : 1;

                      let rowStatus = "normal";
                      if (tpStatus === "hit" || slStatus === "hit") {
                        rowStatus = "executed";
                      } else if (
                        tpStatus === "close" ||
                        slStatus === "close" ||
                        liquidationDistance < 0.05
                      ) {
                        rowStatus = "warning";
                      }

                      return (
                        <tr
                          key={order.orderId}
                          className={`border-b border-neutral-600/20 hover:bg-neutral-800/50 ${
                            rowStatus === "executed"
                              ? "bg-green-500/5"
                              : rowStatus === "warning"
                              ? "bg-yellow-500/5"
                              : ""
                          }`}
                        >
                          <td className="py-3 px-3 text-left text-neutral-400 font-medium">
                            {index + 1}
                          </td>
                          <td className="py-3 px-3 font-medium text-neutral-50">
                            {order.asset || "BTC"}
                            <span className="text-neutral-400 text-xs">/USDT</span>
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-medium ${
                              order.type === "buy"
                                ? "text-[#158BF9]"
                                : "text-[#EB483F]"
                            }`}
                          >
                            {order.type === "buy" ? "LONG" : "SHORT"}
                          </td>
                          <td className="py-3 px-3 text-right text-neutral-50">
                            {toDisplayPriceUSD(order.margin)} USD
                          </td>
                          <td className="py-3 px-3 text-right text-neutral-50">
                            x{order.leverage}
                          </td>
                          <td className="py-3 px-3 text-right text-neutral-50">
                            ${toDisplayPrice(order.openPrice)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {order.takeProfit ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-green-400 font-medium">
                                  ${toDisplayPrice(order.takeProfit)}
                                </span>
                                {(() => {
                                  const { tpStatus } = getTpSlStatus(order);
                                  if (tpStatus === "hit") {
                                    return (
                                      <span className="text-green-500 text-xs">
                                        ✓
                                      </span>
                                    );
                                  } else if (tpStatus === "close") {
                                    return (
                                      <span className="text-yellow-500 text-xs animate-pulse">
                                        !
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <span className="text-neutral-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {order.stopLoss ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-red-400 font-medium">
                                  ${toDisplayPrice(order.stopLoss)}
                                </span>
                                {(() => {
                                  const { slStatus } = getTpSlStatus(order);
                                  if (slStatus === "hit") {
                                    return (
                                      <span className="text-red-500 text-xs">
                                        ✓
                                      </span>
                                    );
                                  } else if (slStatus === "close") {
                                    return (
                                      <span className="text-yellow-500 text-xs animate-pulse">
                                        !
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <span className="text-neutral-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {order.liquidationPrice ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-orange-400 font-medium">
                                  ${toDisplayPrice(order.liquidationPrice)}
                                </span>
                                {(() => {
                                  const sym = (order.asset || "BTC").replace(
                                    "USDT",
                                    ""
                                  );
                                  const p =
                                    latestPrices[sym as keyof LivePrices];
                                  if (!p) return null;
                                  const currentPrice =
                                    order.type === "buy" ? p.bid : p.ask;
                                  const distance =
                                    Math.abs(
                                      currentPrice - order.liquidationPrice
                                    ) / order.liquidationPrice;
                                  if (distance < 0.05) {
                                    return (
                                      <span className="text-red-500 text-xs animate-pulse">
                                        !
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <span className="text-neutral-400 text-xs">—</span>
                            )}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-medium ${
                              order.pnlUsd >= 0
                                ? "text-green-500"
                                : "text-[#EB483F]"
                            }`}
                          >
                            {order.pnlUsd >= 0 ? "+" : ""}
                            {toDisplayPriceUSD(order.pnlUsd)} USD
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => closePosition(order.orderId)}
                                disabled={isClosingPosition === order.orderId}
                                title="Close 100%"
                                className={`px-2 py-1 text-neutral-50 rounded text-xs font-medium transition-colors
                                ${
                                  isClosingPosition === order.orderId
                                    ? "bg-neutral-600 cursor-not-allowed"
                                    : "bg-[#EB483F] hover:bg-[#EB483F]/80"
                                }`}
                              >
                                {isClosingPosition === order.orderId
                                  ? "..."
                                  : "Close"}
                              </button>
                              <button
                                onClick={() => setShowPartialCloseModal(order.orderId)}
                                disabled={isClosingPosition === order.orderId}
                                title="Partial Close"
                                className={`px-2 py-1 text-neutral-50 rounded text-xs font-medium transition-colors
                                ${
                                  isClosingPosition === order.orderId
                                    ? "bg-neutral-600 cursor-not-allowed"
                                    : "bg-yellow-600 hover:bg-yellow-600/80"
                                }`}
                              >
                                Part
                              </button>
                              <button
                                onClick={() => setShowAddMarginModal(order.orderId)}
                                disabled={isClosingPosition === order.orderId}
                                title="Add Margin"
                                className={`px-2 py-1 text-neutral-50 rounded text-xs font-medium transition-colors
                                ${
                                  isClosingPosition === order.orderId
                                    ? "bg-neutral-600 cursor-not-allowed"
                                    : "bg-blue-600 hover:bg-blue-600/80"
                                }`}
                              >
                                +M
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-400">
                No open positions
              </div>
            )}

            {/* Partial Close Modal */}
            {showPartialCloseModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
                setShowPartialCloseModal(null);
                setPartialClosePercentage("50");
              }}>
                <div className="bg-neutral-900 border border-neutral-600 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-neutral-50 mb-4">Partial Close Position</h3>
                  <div className="mb-4">
                    <label className="block text-sm text-neutral-400 mb-2">Close Percentage (%)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={partialClosePercentage}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow empty string or valid number
                        if (value === "" || /^\d+$/.test(value)) {
                          setPartialClosePercentage(value);
                        }
                      }}
                      onFocus={(e) => {
                        // Clear default value on focus for better UX
                        if (e.target.value === "50") {
                          setPartialClosePercentage("");
                        }
                      }}
                      onBlur={(e) => {
                        // Restore default if empty on blur
                        if (e.target.value === "") {
                          setPartialClosePercentage("50");
                        }
                      }}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-neutral-50 focus:outline-none focus:border-yellow-500"
                      placeholder="50"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Enter 1-99% (cannot close 100% here)</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPartialCloseModal(null);
                        setPartialClosePercentage("50");
                      }}
                      className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-50 rounded text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePartialClose(showPartialCloseModal);
                      }}
                      disabled={isClosingPosition === showPartialCloseModal}
                      className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-600/80 text-neutral-50 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isClosingPosition === showPartialCloseModal ? "Closing..." : `Confirm Close ${partialClosePercentage}%`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Margin Modal */}
            {showAddMarginModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
                setShowAddMarginModal(null);
                setAdditionalMargin("100");
              }}>
                <div className="bg-neutral-900 border border-neutral-600 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-neutral-50 mb-4">Add Margin to Position</h3>
                  <div className="mb-4">
                    <label className="block text-sm text-neutral-400 mb-2">Additional Margin ($)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={additionalMargin}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow empty string or valid number (including decimals)
                        if (value === "" || /^\d*\.?\d*$/.test(value)) {
                          setAdditionalMargin(value);
                        }
                      }}
                      onFocus={(e) => {
                        // Clear default value on focus for better UX
                        if (e.target.value === "100") {
                          setAdditionalMargin("");
                        }
                      }}
                      onBlur={(e) => {
                        // Restore default if empty on blur
                        if (e.target.value === "") {
                          setAdditionalMargin("100");
                        }
                      }}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-neutral-50 focus:outline-none focus:border-blue-500"
                      placeholder="100"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Minimum $10 USD</p>
                    <p className="text-xs text-blue-400 mt-2">Adding margin reduces liquidation risk by lowering effective leverage</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddMarginModal(null);
                        setAdditionalMargin("100");
                      }}
                      className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-50 rounded text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddMargin(showAddMarginModal);
                      }}
                      disabled={isClosingPosition === showAddMarginModal}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-600/80 text-neutral-50 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isClosingPosition === showAddMarginModal ? "Adding..." : `Add $${additionalMargin}`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : closedOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-400 border-b border-neutral-600/40">
                  <th className="py-3 px-3 text-left font-medium w-12">#</th>
                  <th className="py-3 px-3 text-left font-medium">Symbol</th>
                  <th className="py-3 px-3 text-right font-medium">Type</th>
                  <th className="py-3 px-3 text-right font-medium">Margin</th>
                  <th className="py-3 px-3 text-right font-medium">Open Price</th>
                  <th className="py-3 px-3 text-right font-medium">Close Price</th>
                  <th className="py-3 px-3 text-right font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {closedOrders.map((order, index) => (
                  <tr
                    key={order.orderId}
                    className="border-b border-neutral-600/20 hover:bg-neutral-800/50"
                  >
                    <td className="py-3 px-3 text-left text-neutral-400 font-medium">
                      {index + 1}
                    </td>
                    <td className="py-3 px-3 font-medium text-neutral-50">
                      {order.asset || "BTC"}
                      <span className="text-neutral-400 text-xs">/USDT</span>
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-medium ${
                        order.type === "buy"
                          ? "text-[#158BF9]"
                          : "text-[#EB483F]"
                      }`}
                    >
                      {order.type === "buy" ? "LONG" : "SHORT"}
                    </td>
                    <td className="py-3 px-3 text-right text-neutral-50">
                      {toDisplayPriceUSD(order.margin)} USD
                    </td>
                    <td className="py-3 px-3 text-right text-neutral-50">
                      ${toDisplayPrice(order.openPrice)}
                    </td>
                    <td className="py-3 px-3 text-right text-neutral-50">
                      ${toDisplayPrice(order.closePrice)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-medium ${
                        toDisplayPriceUSD(order.pnl) >= 0
                          ? "text-green-500"
                          : "text-[#EB483F]"
                      }`}
                    >
                      {toDisplayPriceUSD(order.pnl) >= 0 ? "+" : ""}
                      {toDisplayPriceUSD(order.pnl)} USD
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-400">No order history</div>
        )}
      </div>
    </div>
  );
}
