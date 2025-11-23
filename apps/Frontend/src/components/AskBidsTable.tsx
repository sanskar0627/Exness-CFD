import { useEffect, useState } from "react";
import { type SYMBOL } from "../utils/constants";
import { toDisplayPrice } from "../utils/utils";
import { subscribePrices, type LivePrices } from "../utils/price_store";

export interface Trade {
  bidPrice: number;
  askPrice: number;
  symbol: SYMBOL;
}


const imageUrl = {

  SOL: "https://i.postimg.cc/9MhDvsK9/b2f0c70f-4fb2-4472-9fe7-480ad1592421.png",
  ETH: "https://i.postimg.cc/gcKhPkY2/3a8c9fe6-2a76-4ace-aa07-415d994de6f0.png",
  BTC: "https://i.postimg.cc/TPh0K530/87496d50-2408-43e1-ad4c-78b47b448a6a.png",
};

export default function AskBids({ symbol }: { symbol?: SYMBOL }) {
  const [bid_asks, setBidsAsks] = useState({
    SOL: {
      bids: 0,
      asks: 0,
      symbol: "SOL",
    },
    ETH: {
      bids: 0,
      asks: 0,
      symbol: "ETH",
    },
    BTC: {
      bids: 0,
      asks: 0,
      symbol: "BTC",
    },
  });

  useEffect(() => {
    const unsubscribe = subscribePrices((prices: LivePrices) => {
      setBidsAsks({
        BTC: { bids: toDisplayPrice(prices.BTC.ask), asks: toDisplayPrice(prices.BTC.bid), symbol: "BTC" },
        ETH: { bids: toDisplayPrice(prices.ETH.ask), asks: toDisplayPrice(prices.ETH.bid), symbol: "ETH" },
        SOL: { bids: toDisplayPrice(prices.SOL.ask), asks: toDisplayPrice(prices.SOL.bid), symbol: "SOL" },
      });
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-neutral-400 border-b border-neutral-600/40">
            <th className="py-3 text-left font-medium">Symbol</th>
            <th className="py-3 text-right font-medium">Bid</th>
            <th className="py-3 text-right font-medium">Ask</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-600/20">
          {Object.values(bid_asks).map((item) => (
            <tr
              key={item.symbol}
              className={`hover:bg-neutral-800/50 transition-colors ${
                symbol === `${item.symbol}USDT` ? "bg-neutral-800/30" : ""
              }`}
            >
              <th className="py-4 text-left font-medium text-neutral-50">
                <div className="flex items-center">
                  <img
                    src={imageUrl[item.symbol as keyof typeof imageUrl]}
                    alt={item.symbol}
                    className="h-6 w-6 rounded-full inline-block mr-3"
                  />
                  <div>
                    <div className="text-sm font-semibold">{item.symbol}</div>
                    <div className="text-xs text-neutral-400">USDT</div>
                  </div>
                </div>
              </th>
              <td className="py-4 text-right font-mono text-[#158BF9] font-semibold">
                {item.asks}
              </td>
              <td className="py-4 text-right font-mono text-[#EB483F] font-semibold">
                {item.bids}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
