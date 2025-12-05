"use client";

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import type { SYMBOL } from "../utils/constants";
import { createTrade, findUserAmount } from "../api/trade";
import { getAssetDetails } from "../api/trade";
import type { Asset } from "../types/asset";
import {
  calculatePnlCents,
  toDisplayPriceUSD,
  toInternalPrice,
} from "../utils/utils";

export default function BuySell({
  askPrice,
  bidPrice,
  symbol,
  onOrderPlaced,
}: {
  askPrice: number;
  bidPrice: number;
  symbol: SYMBOL;
  onOrderPlaced?: () => void;
}) {
  const [orderType, setOrderType] = useState<"market" | "pending">("market");
  const [margin, setMargin] = useState<number | string>(100);
  const [leverage, setLeverage] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [tpEnabled, setTpEnabled] = useState<boolean>(false);
  const [slEnabled, setSlEnabled] = useState<boolean>(false);
  const [tpPrice, setTpPrice] = useState<string>("");
  const [slPrice, setSlPrice] = useState<string>("");
  const [tpPercentage, setTpPercentage] = useState<number>(5); // Default 5% profit
  const [slPercentage, setSlPercentage] = useState<number>(5); // Default 5% loss
  const [tpManualEdit, setTpManualEdit] = useState<boolean>(false); // Track manual editing
  const [slManualEdit, setSlManualEdit] = useState<boolean>(false); // Track manual editing
  const [tslEnabled, setTslEnabled] = useState<boolean>(false); // Trailing Stop Loss
  const [tslDistance, setTslDistance] = useState<string>("500"); // Default $500 trailing distance
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [userBalance, setUserBalance] = useState<number>(0);
  const [currentAsset, setCurrentAsset] = useState<Asset | null>(null);

  // Reset manual edit flags when switching tabs
  useEffect(() => {
    setTpManualEdit(false);
    setSlManualEdit(false);
  }, [activeTab]);

  // Auto-calculate TP/SL when enabled or percentage changes (but NOT when manually editing)
  useEffect(() => {
    const currentPrice = activeTab === "buy" ? askPrice : bidPrice;

    // Only auto-calculate if NOT in manual edit mode
    if (tpEnabled && currentPrice > 0 && !tpManualEdit) {
      // For BUY: TP is ABOVE entry (profit when price goes UP)
      // For SELL: TP is BELOW entry (profit when price goes DOWN)
      const tpCalculated =
        activeTab === "buy"
          ? currentPrice * (1 + tpPercentage / 100)
          : currentPrice * (1 - tpPercentage / 100);
      setTpPrice(tpCalculated.toFixed(2));
    }

    // Only auto-calculate if NOT in manual edit mode
    if (slEnabled && currentPrice > 0 && !slManualEdit) {
      // For BUY: SL is BELOW entry (loss when price goes DOWN)
      // For SELL: SL is ABOVE entry (loss when price goes UP)
      const slCalculated =
        activeTab === "buy"
          ? currentPrice * (1 - slPercentage / 100)
          : currentPrice * (1 + slPercentage / 100);
      setSlPrice(slCalculated.toFixed(2));
    }
  }, [tpEnabled, slEnabled, tpPercentage, slPercentage, activeTab, askPrice, bidPrice, tpManualEdit, slManualEdit]);

  useEffect(() => {
    const getUserBalance = async () => {
      try {
        const response = await findUserAmount();
        if (response && response.balance && response.balance.usd) {
          setUserBalance(response.balance.usd);
        }
      } catch (err) {
        console.error("Error fetching user balance", err);
      }
    };

    const getAssets = async () => {
      try {
        const assetData = await getAssetDetails();
        if (assetData.length > 0) {
          const asset = assetData.find((a) => a.symbol === symbol);
          if (asset) {
            setCurrentAsset(asset);
          }
        }
      } catch (error) {
        console.error("Error loading assets:", error);
      }
    };

    getUserBalance();
    getAssets();

    const balanceIntervalId = setInterval(getUserBalance, 10000);
    const assetsIntervalId = setInterval(getAssets, 30000);

    return () => {
      clearInterval(balanceIntervalId);
      clearInterval(assetsIntervalId);
    };
  }, [symbol]);

  const estimatedTpPnlInCents = useMemo(() => {
    if (!tpEnabled || !tpPrice || Number(tpPrice) <= 0) return 0;

    // 1. Convert all inputs to the correct scaled-integer format
    const openPriceForCalc =
      activeTab === "buy"
        ? toInternalPrice(askPrice)
        : toInternalPrice(bidPrice);
    const closePriceForCalc = toInternalPrice(Number(tpPrice));
    const marginForCalc = Number(margin) * 100; // Convert dollar margin to cents

    // 2. Call the exact same robust function used everywhere else
    return calculatePnlCents({
      side: activeTab,
      openPrice: openPriceForCalc,
      closePrice: closePriceForCalc,
      marginCents: marginForCalc,
      leverage: leverage,
    });
  }, [tpEnabled, tpPrice, activeTab, askPrice, bidPrice, margin, leverage]);

  const estimatedSlPnlInCents = useMemo(() => {
    if (!slEnabled || !slPrice || Number(slPrice) <= 0) return 0;

    // 1. Convert all inputs to the correct scaled-integer format
    const openPriceForCalc =
      activeTab === "buy"
        ? toInternalPrice(askPrice)
        : toInternalPrice(bidPrice);
    const closePriceForCalc = toInternalPrice(Number(slPrice));
    const marginForCalc = Number(margin) * 100; // Convert dollar margin to cents

    // 2. Call the robust P&L function
    return calculatePnlCents({
      side: activeTab,
      openPrice: openPriceForCalc,
      closePrice: closePriceForCalc,
      marginCents: marginForCalc,
      leverage: leverage,
    });
  }, [slEnabled, slPrice, activeTab, askPrice, bidPrice, margin, leverage]);

  const handleSubmitTrade = async () => {
    const marginValue = Number(margin);
    if (marginValue <= 0) {
      setError("Margin must be greater than 0");
      setTimeout(() => setError(""), 3000);
      return;
    }

    // CRITICAL FIX: Check balance INCLUDING 0.5% fee (matches backend calculation)
    const openFee = marginValue * 0.005; // 0.5% fee on margin entry
    const totalCost = marginValue + openFee;

    if (totalCost > userBalance) {
      setError(`Insufficient balance. Need $${totalCost.toFixed(2)} (margin: $${marginValue.toFixed(2)} + 0.5% fee: $${openFee.toFixed(2)})`);
      setTimeout(() => setError(""), 4000);
      return;
    }

    // CRITICAL FIX: Client-side TP/SL validation for immediate feedback
    const entryPrice = activeTab === "buy" ? askPrice : bidPrice;

    if (tpEnabled && tpPrice) {
      const takeProfitValue = Number(tpPrice);
      if (activeTab === "buy" && takeProfitValue <= entryPrice) {
        setError(`Invalid Take Profit. For BUY orders, TP must be higher than entry price ($${entryPrice.toFixed(2)})`);
        setTimeout(() => setError(""), 4000);
        return;
      }
      if (activeTab === "sell" && takeProfitValue >= entryPrice) {
        setError(`Invalid Take Profit. For SELL orders, TP must be lower than entry price ($${entryPrice.toFixed(2)})`);
        setTimeout(() => setError(""), 4000);
        return;
      }
    }

    if (slEnabled && slPrice) {
      const stopLossValue = Number(slPrice);
      if (activeTab === "buy" && stopLossValue >= entryPrice) {
        setError(`Invalid Stop Loss. For BUY orders, SL must be lower than entry price ($${entryPrice.toFixed(2)})`);
        setTimeout(() => setError(""), 4000);
        return;
      }
      if (activeTab === "sell" && stopLossValue <= entryPrice) {
        setError(`Invalid Stop Loss. For SELL orders, SL must be higher than entry price ($${entryPrice.toFixed(2)})`);
        setTimeout(() => setError(""), 4000);
        return;
      }
    }

    // CRITICAL FIX: Validate Trailing Stop Loss minimum distance
    if (tslEnabled && tslDistance) {
      const tslDistanceValue = Number(tslDistance);
      if (tslDistanceValue < 10) {
        setError(`Invalid Trailing Stop Loss. Minimum distance is $10 to prevent instant closure (you entered $${tslDistance})`);
        setTimeout(() => setError(""), 4000);
        return;
      }
      if (tslDistanceValue > 10000) {
        setError(`Invalid Trailing Stop Loss. Maximum distance is $10,000 (you entered $${tslDistance})`);
        setTimeout(() => setError(""), 4000);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError("");

      const token = localStorage.getItem("token") || "";

      const response = await createTrade({
        symbol,
        activeTab,
        margin: marginValue,
        leverage,
        tpEnabled,
        tpPrice,
        slEnabled,
        slPrice,
        tslEnabled,
        tslDistance,
        token,
      });
      
      console.log("Response from backend:", response);
      
      if (response && response.order && response.order.orderId) {
        setSuccess(`Order placed successfully!`);
        setTimeout(() => setSuccess(""), 3000);

        const balanceResponse = await findUserAmount();
        if (balanceResponse && balanceResponse.balance && balanceResponse.balance.usd) {
          setUserBalance(balanceResponse.balance.usd);
        }
        
        // Trigger immediate refresh of orders
        if (onOrderPlaced) {
          onOrderPlaced();
        }
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Failed to place order");
        setTimeout(() => setError(""), 3000);
      } else {
        setError("An unexpected error occurred");
        setTimeout(() => setError(""), 3000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <aside
      className="w-full rounded-lg border border-neutral-600 bg-neutral-900/80 backdrop-blur-xl text-neutral-50 shadow-sm h-full flex flex-col"
      aria-label="Trade ticket"
    >
      <div className="flex border-b border-neutral-600/40">
        <button
          onClick={() => setActiveTab("buy")}
          className={`flex-1 py-3 text-center font-medium text-sm transition ${
            activeTab === "buy"
              ? "text-[#158BF9] border-b-2 border-[#158BF9]"
              : "text-neutral-300 hover:text-neutral-50"
          }`}
        >
          Buy {symbol}
        </button>
        <button
          onClick={() => setActiveTab("sell")}
          className={`flex-1 py-3 text-center font-medium text-sm transition ${
            activeTab === "sell"
              ? "text-[#EB483F] border-b-2 border-[#EB483F]"
              : "text-neutral-300 hover:text-neutral-50"
          }`}
        >
          Sell {symbol}
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-50">
              {activeTab === "buy" ? "Buy Order" : "Sell Order"}
            </h2>
            <span className="rounded-md border border-neutral-600 bg-neutral-800/60 backdrop-blur-sm px-3 py-1 text-xs text-neutral-300">
              {orderType === "market" ? "Market" : "Limit"}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            {currentAsset ? (
              <div className="flex items-center gap-3 p-3 bg-neutral-800/60 backdrop-blur-sm rounded-md border border-neutral-600">
                <img
                  src={currentAsset.imageUrl}
                  alt={currentAsset.name}
                  className="h-6 w-6 rounded-full"
                />
                <div>
                  <div className="text-sm font-semibold text-neutral-50">
                    {currentAsset.name}
                  </div>
                  <div className="text-xs text-neutral-400">{symbol}/USDT</div>
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold text-neutral-50">
                {symbol}
              </div>
            )}
            <div className="text-xs ml-auto bg-neutral-800/60 backdrop-blur-sm px-3 py-2 rounded-md border border-neutral-600">
              <span className="text-neutral-300">Balance:</span>
              <span className="text-green-400 font-medium ml-2">
                ${userBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 mt-4" aria-label="Prices">
          <div className="rounded-lg border border-neutral-600 bg-neutral-800/60 backdrop-blur-sm p-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-400">Sell Price</div>
              <div className="text-xs bg-[#EB483F]/20 text-[#EB483F] px-2 py-1 rounded">
                SELL
              </div>
            </div>
            <div className="mt-2 text-lg font-semibold text-[#EB483F] flex items-center">
              <span className="text-sm mr-1">$</span>
              {bidPrice}
            </div>
            <div className="absolute w-1 h-full bg-[#EB483F]/40 left-0 top-0"></div>
          </div>
          <div className="rounded-lg border border-neutral-600 bg-neutral-800/60 backdrop-blur-sm p-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-400">Buy Price</div>
              <div className="text-xs bg-[#158BF9]/20 text-[#158BF9] px-2 py-1 rounded">
                BUY
              </div>
            </div>
            <div className="mt-2 text-lg font-semibold text-[#158BF9] flex items-center">
              <span className="text-sm mr-1">$</span>
              {askPrice}
            </div>
            <div className="absolute w-1 h-full bg-[#158BF9]/40 left-0 top-0"></div>
          </div>
        </section>

        <section className="mt-4" aria-label="Risk indicator">
          <div className="bg-neutral-800/60 backdrop-blur-sm border border-neutral-600 rounded-md p-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
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
                  className="text-neutral-400"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span className="text-neutral-400">Risk Level</span>
              </div>
              <span className="font-medium text-green-400 bg-green-500/10 px-2 py-1 rounded text-xs">
                LOW
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-neutral-600 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-400"
                style={{ width: "30%" }}
                aria-hidden="true"
              />
            </div>
          </div>
        </section>

        <div className="mt-3 bg-[#0f171b] border border-[#263136] rounded-md p-2">
          <div className="flex items-center gap-1 mb-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/60"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span className="text-xs text-white/60">Order Type</span>
          </div>
          <nav
            className="inline-flex w-full rounded-md border border-[#263136] bg-[#141D22] p-0.5"
            role="tablist"
            aria-label="Order type"
          >
            <button
              role="tab"
              aria-selected={orderType === "market"}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                orderType === "market"
                  ? "bg-[#1c2a31] text-white shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
              onClick={() => setOrderType("market")}
            >
              Market
            </button>
            <button
              role="tab"
              aria-selected={orderType === "pending"}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                orderType === "pending"
                  ? "bg-[#1c2a31] text-white shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
              onClick={() => setOrderType("pending")}
            >
              Limit
            </button>
          </nav>
        </div>

        <section className="mt-3 bg-[#0f171b] border border-[#263136] rounded-md p-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/60"
              >
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              <label htmlFor="margin" className="text-xs text-white/60">
                Trading Margin
              </label>
            </div>
            <span className="text-[10px] text-white/50 bg-[#1c2a31] px-1.5 py-0.5 rounded">
              ${margin} USD
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease margin"
              className="rounded-md border border-[#263136] px-2 py-1 text-xs text-white/80 hover:bg-[#1c2a31] transition-colors"
              onClick={() => setMargin((prev) => Math.max(10, Number(prev) - 10))}
              disabled={isSubmitting}
            >
              −
            </button>
            <div className="w-full relative">
              <div className="absolute left-0 top-0 h-full px-2 flex items-center">
                <span className="text-xs text-white/50">$</span>
              </div>
              <input
                id="margin"
                name="margin"
                type="number"
                min={10}
                step={10}
                value={margin}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setMargin("");
                  } else {
                    setMargin(Number(val));
                  }
                }}
                disabled={isSubmitting}
                className="w-full rounded-md border border-[#263136] bg-[#141D22] pl-6 pr-2 py-1.5 text-xs outline-none focus:border-[#158BF9] transition-colors"
              />
            </div>
            <button
              type="button"
              aria-label="Increase margin"
              className="rounded-md border border-[#263136] px-2 py-1 text-xs text-white/80 hover:bg-[#1c2a31] transition-colors"
              onClick={() => setMargin((prev) => Number(prev) + 10)}
              disabled={isSubmitting}
            >
              +
            </button>
          </div>

          <div className="mt-2 h-1 w-full bg-[#263136] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#158BF9]/30 to-[#158BF9]/80"
              style={{
                width: `${Math.min(100, (Number(margin) / userBalance) * 100)}%`,
              }}
            ></div>
          </div>
        </section>

        <section className="mt-3 bg-[#0f171b] border border-[#263136] rounded-md p-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/60"
              >
                <path d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1"></path>
                <polygon points="12 15 17 21 7 21 12 15"></polygon>
              </svg>
              <label className="text-xs text-white/60">Leverage</label>
            </div>
            <div className="flex items-center">
              <div className="text-xs text-white/50 bg-[#1c2a31] px-1.5 py-0.5 rounded mr-1">
                <span className="text-white/70 font-medium">{leverage}x</span>
              </div>
              <div className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                ${(Number(margin) * leverage).toLocaleString("en-US")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {[1, 2, 5, 10, 20, 100].map((lev) => (
              <button
                key={lev}
                type="button"
                className={`rounded-md border relative overflow-hidden ${
                  leverage === lev
                    ? lev >= 100
                      ? "border-red-500 bg-red-500/10 text-red-400"
                      : lev >= 20
                      ? "border-orange-500 bg-orange-500/10 text-orange-400"
                      : "border-[#158BF9] bg-[#158BF9]/10 text-[#158BF9]"
                    : "border-[#263136] text-white/70 hover:bg-[#1c2a31]"
                } px-1 py-1.5 text-xs transition-all`}
                onClick={() => setLeverage(lev)}
                disabled={isSubmitting}
              >
                {leverage === lev && (
                  <div className={`absolute top-0 left-0 w-1 h-full ${
                    lev >= 100 ? "bg-red-500" : lev >= 20 ? "bg-orange-500" : "bg-[#158BF9]"
                  }`}></div>
                )}
                {lev}x
              </button>
            ))}
          </div>

          {/* CRITICAL: High leverage warnings */}
          {leverage >= 100 && (
            <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 p-2">
              <div className="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 flex-shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-red-400">EXTREME RISK - 100x Leverage</div>
                  <div className="text-[10px] text-red-300/80">
                    A 1% price move against you = 100% loss (instant liquidation). Only use if you understand the extreme risk.
                  </div>
                </div>
              </div>
            </div>
          )}

          {leverage >= 20 && leverage < 100 && (
            <div className="mt-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-2">
              <div className="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400 flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <div className="text-[10px] text-orange-300/80">
                  High leverage ({leverage}x) = High risk. A {(100 / leverage).toFixed(1)}% move against you will liquidate your position.
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="mt-3 space-y-2">
          <div className="bg-[#0f171b] border border-[#263136] rounded-md p-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/60"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <label htmlFor="tp-toggle" className="text-xs text-white/60">
                  Take Profit
                </label>
                <span className="bg-green-500/10 text-green-400 text-[10px] px-1.5 py-0.5 rounded">
                  Recommended
                </span>
              </div>
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="tp-toggle"
                    type="checkbox"
                    className="sr-only peer"
                    checked={tpEnabled}
                    onChange={(e) => setTpEnabled(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-[#1c2a31] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/30 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#158BF9]/30"></div>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <div className="absolute left-0 top-0 h-full px-2 flex items-center">
                  <span className="text-xs text-white/50">$</span>
                </div>
                <input
                  id="tp-price"
                  name="tp"
                  type="number"
                  step="0.01"
                  placeholder="Target Price"
                  disabled={!tpEnabled}
                  value={tpPrice}
                  onChange={(e) => {
                    setTpPrice(e.target.value);
                    setTpManualEdit(true); // User is manually editing
                  }}
                  className={`
                    w-full rounded-md border border-[#263136] bg-[#141D22] pl-6 pr-2 py-1.5 text-xs outline-none
                    ${
                      tpEnabled
                        ? "focus:border-[#158BF9] transition-colors"
                        : "opacity-50"
                    }
                  `}
                />
              </div>

              {tpEnabled && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-white/50">Quick:</span>
                  {[2, 5, 10, 15].map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      onClick={() => {
                        setTpPercentage(percent);
                        setTpManualEdit(false); // Re-enable auto-calculation
                      }}
                      className={`flex-1 text-[10px] px-2 py-1 rounded border transition-colors ${
                        tpPercentage === percent && !tpManualEdit
                          ? "border-green-500 bg-green-500/20 text-green-400"
                          : "border-[#263136] bg-[#141D22] text-white/60 hover:border-green-500/50"
                      }`}
                    >
                      +{percent}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {tpEnabled && (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <div className="text-[10px] text-white/50">
                      Est. Profit:
                    </div>
                  </div>
                  <div
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      estimatedTpPnlInCents > 0
                        ? "text-green-400 bg-green-500/10"
                        : "text-red-400 bg-red-500/10"
                    }`}
                  >
                    {estimatedTpPnlInCents >= 0 ? "+$" : "-$"}
                    {toDisplayPriceUSD(Math.abs(estimatedTpPnlInCents)).toFixed(
                      2
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-white/40">
                  Target: ${tpPrice} | Current: $
                  {activeTab === "buy" ? askPrice : bidPrice}
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#0f171b] border border-[#263136] rounded-md p-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/60"
                >
                  <path d="M10 16l-6-6 6-6"></path>
                  <path d="M20 21v-7a4 4 0 0 0-4-4H5"></path>
                </svg>
                <label htmlFor="sl-toggle" className="text-xs text-white/60">
                  Stop Loss
                </label>
                <span className="bg-red-500/10 text-red-400 text-[10px] px-1.5 py-0.5 rounded">
                  Risk Protection
                </span>
              </div>
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="sl-toggle"
                    type="checkbox"
                    className="sr-only peer"
                    checked={slEnabled}
                    onChange={(e) => setSlEnabled(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-[#1c2a31] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/30 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#EB483F]/30"></div>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <div className="absolute left-0 top-0 h-full px-2 flex items-center">
                  <span className="text-xs text-white/50">$</span>
                </div>
                <input
                  id="sl-price"
                  name="sl"
                  type="number"
                  step="0.01"
                  placeholder="Stop Price"
                  disabled={!slEnabled}
                  value={slPrice}
                  onChange={(e) => {
                    setSlPrice(e.target.value);
                    setSlManualEdit(true); // User is manually editing
                  }}
                  className={`
                    w-full rounded-md border border-[#263136] bg-[#141D22] pl-6 pr-2 py-1.5 text-xs outline-none
                    ${
                      slEnabled
                        ? "focus:border-[#EB483F] transition-colors"
                        : "opacity-50"
                    }
                  `}
                />
              </div>

              {slEnabled && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-white/50">Quick:</span>
                  {[2, 5, 10, 15].map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      onClick={() => {
                        setSlPercentage(percent);
                        setSlManualEdit(false); // Re-enable auto-calculation
                      }}
                      className={`flex-1 text-[10px] px-2 py-1 rounded border transition-colors ${
                        slPercentage === percent && !slManualEdit
                          ? "border-red-500 bg-red-500/20 text-red-400"
                          : "border-[#263136] bg-[#141D22] text-white/60 hover:border-red-500/50"
                      }`}
                    >
                      -{percent}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {slEnabled && (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <div className="text-[10px] text-white/50">Est. Loss:</div>
                  </div>
                  <div
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      estimatedSlPnlInCents < 0
                        ? "text-red-400 bg-red-500/10"
                        : "text-green-400 bg-green-500/10"
                    }`}
                  >
                    {/* Always show loss as negative, but use abs for the number */}
                    {estimatedSlPnlInCents > 0 ? "+$" : "-$"}
                    {toDisplayPriceUSD(Math.abs(estimatedSlPnlInCents)).toFixed(
                      2
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-white/40">
                  Stop: ${slPrice} | Current: $
                  {activeTab === "buy" ? askPrice : bidPrice}
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#0f171b] border border-[#263136] rounded-md p-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/60"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                <label htmlFor="tsl-toggle" className="text-xs text-white/60">
                  Trailing Stop Loss
                </label>
                <span className="bg-yellow-500/10 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded">
                  Advanced
                </span>
              </div>
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="tsl-toggle"
                    type="checkbox"
                    className="sr-only peer"
                    checked={tslEnabled}
                    onChange={(e) => setTslEnabled(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-[#1c2a31] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/30 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500/30"></div>
                </label>
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-0 top-0 h-full px-2 flex items-center">
                <span className="text-xs text-white/50">$</span>
              </div>
              <input
                id="tsl-distance"
                name="tsl"
                type="number"
                step="10"
                placeholder="Trailing Distance (e.g. 500)"
                disabled={!tslEnabled}
                value={tslDistance}
                onChange={(e) => setTslDistance(e.target.value)}
                className={`
                  w-full rounded-md border border-[#263136] bg-[#141D22] pl-6 pr-2 py-1.5 text-xs outline-none
                  ${
                    tslEnabled
                      ? "focus:border-yellow-500 transition-colors"
                      : "opacity-50"
                  }
                `}
              />
            </div>

            {tslEnabled && (
              <div className="mt-1.5 space-y-1">
                <div className="text-[10px] text-white/40">
                  Locks in profit as price moves in your favor. Stop loss moves with price but never reverses.
                </div>
                <div className="text-[10px] text-yellow-500/60">
                  Minimum: $10 | Recommended: $50-$500
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-white/50">
                    Distance from peak:
                  </div>
                  <div className="text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                    ${tslDistance}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-2 p-1 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-[10px]">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-2 p-1 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-[10px]">
            {success}
          </div>
        )}

        {/* CRITICAL: Display 0.5% fee before submission */}
        <div className="mt-3 rounded-md border border-neutral-600/40 bg-neutral-800/40 p-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/50">Margin:</span>
              <span className="text-white/80">${Number(margin).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/50">Fee (0.5%):</span>
              <span className="text-orange-400">${(Number(margin) * 0.005).toFixed(2)}</span>
            </div>
            <div className="h-px bg-neutral-600/30 my-1"></div>
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-white/70">Total Cost:</span>
              <span className="text-white">${(Number(margin) + Number(margin) * 0.005).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <button
          className={`mt-3 w-full rounded-md px-3 py-3 text-xs font-semibold transition-all flex items-center justify-center gap-2 relative overflow-hidden ${
            activeTab === "buy"
              ? "bg-gradient-to-r from-[#158BF9]/90 to-[#158BF9] hover:from-[#158BF9] hover:to-[#158BF9]/90 text-white"
              : "bg-gradient-to-r from-[#EB483F]/90 to-[#EB483F] hover:from-[#EB483F] hover:to-[#EB483F]/90 text-white"
          } ${isSubmitting ? "opacity-80 cursor-not-allowed" : ""}`}
          aria-label={
            activeTab === "buy" ? "Place buy order" : "Place sell order"
          }
          onClick={handleSubmitTrade}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Processing...</span>
            </>
          ) : (
            <>
              {activeTab === "buy" ? (
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
                  <path d="M12 5v14"></path>
                  <path d="M19 12l-7-7-7 7"></path>
                </svg>
              ) : (
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
                  <path d="M12 19V5"></path>
                  <path d="M5 12l7 7 7-7"></path>
                </svg>
              )}
              <span>
                {activeTab === "buy" ? "Buy" : "Sell"} {symbol}
              </span>
            </>
          )}
        </button>

        <div className="mt-2 p-1.5 rounded bg-[#0f171b]/80 border border-[#263136]">
          <div className="flex items-center gap-1.5 justify-center">
            {orderType === "market" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/40"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/40"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            )}
            <p className="text-center text-[10px] text-white/40">
              {orderType === "market"
                ? "Instant execution at market price."
                : "Order will trigger when price meets condition."}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
