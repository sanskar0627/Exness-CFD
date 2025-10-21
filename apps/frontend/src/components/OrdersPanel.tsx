import { useEffect, useMemo, useState } from "react";
import { closetrade, getclosedtrades, getopentrades } from "../api/trade";
import {
  calculatePnlCents,
  toDisplayPrice,
  toDisplayPriceUSD,
  toInternalPrice,
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

export default function OrdersPanel() {
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [closedOrders, setClosedOrders] = useState<ClosedOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isClosingPosition, setIsClosingPosition] = useState<string | null>(
    null
  );
  const [latestPrices, setLatestPrices] = useState<LivePrices>({
    BTC: { bid: 0, ask: 0 },
    ETH: { bid: 0, ask: 0 },
    SOL: { bid: 0, ask: 0 },
  });

  const fetchOpenOrders = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token") || "";

      const response = await getopentrades(token);
      setOpenOrders(response?.data.trades || []);
    } catch (error) {
      console.error("Error fetching open orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClosedOrders = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token") || "";

      const response = await getclosedtrades(token);
      console.log(`📜 Fetched ${response.data.trades?.length || 0} closed trades:`, response.data.trades);
      setClosedOrders(response.data.trades || []);
    } catch (error) {
      console.error("Error fetching closed orders:", error);
    } finally {
      setIsLoading(false);
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
        fetchOpenOrders();
      } else {
        fetchClosedOrders();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeTab]);

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
      // Convert current price from display format to internal format for calculation
      const pnlInCents = calculatePnlCents({
        side: o.type,
        openPrice: o.openPrice,
        closePrice: toInternalPrice(currentcloseprice),
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

    // Convert current price from display format to internal format for comparison
    const currentPriceDisplay = order.type === "buy" ? p.bid : p.ask;
    const currentPrice = toInternalPrice(currentPriceDisplay);

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
                  <span className="text-red-500 animate-pulse">⚠</span>
                  <span>Near Liquidation</span>
                </div>
              </div>
            </div>
            {openWithPnl.length > 0 ? (
              <div className="overflow-x-auto h-full">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-neutral-900/80 backdrop-blur-sm z-10">
                    <tr className="text-xs text-neutral-400 border-b border-neutral-600/40">
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
                    {openWithPnl.map((order) => {
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
                                        ⚠
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
                            <button
                              onClick={() => closePosition(order.orderId)}
                              disabled={isClosingPosition === order.orderId}
                              className={`px-3 py-2 text-neutral-50 rounded text-sm font-medium transition-colors
                            ${
                              isClosingPosition === order.orderId
                                ? "bg-neutral-600 cursor-not-allowed"
                                : "bg-[#EB483F] hover:bg-[#EB483F]/80"
                            }`}
                            >
                              {isClosingPosition === order.orderId
                                ? "Closing..."
                                : "Close"}
                            </button>
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
          </>
        ) : closedOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-400 border-b border-neutral-600/40">
                  <th className="py-3 px-3 text-left font-medium">Symbol</th>
                  <th className="py-3 px-3 text-right font-medium">Type</th>
                  <th className="py-3 px-3 text-right font-medium">Margin</th>
                  <th className="py-3 px-3 text-right font-medium">Open Price</th>
                  <th className="py-3 px-3 text-right font-medium">Close Price</th>
                  <th className="py-3 px-3 text-right font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {closedOrders.map((order) => (
                  <tr
                    key={order.orderId}
                    className="border-b border-neutral-600/20 hover:bg-neutral-800/50"
                  >
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
                      ${order.margin.toFixed(2)} USD
                    </td>
                    <td className="py-3 px-3 text-right text-neutral-50">
                      ${toDisplayPrice(order.openPrice)}
                    </td>
                    <td className="py-3 px-3 text-right text-neutral-50">
                      ${toDisplayPrice(order.closePrice)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-medium ${
                        order.pnl >= 0
                          ? "text-green-500"
                          : "text-[#EB483F]"
                      }`}
                    >
                      {order.pnl >= 0 ? "+" : ""}
                      ${order.pnl.toFixed(2)} USD
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
