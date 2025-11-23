import { Signalingmanager } from "./subscription_manager";
import { Channels } from "./constants";

export type BaseSymbol = "BTC" | "ETH" | "SOL";

export interface LivePrice {
  bid: number; // price user can buy at (our buyPrice)
  ask: number; // price user can sell at (our sellPrice)
}

export type LivePrices = Record<BaseSymbol, LivePrice>;

type Listener = (prices: LivePrices) => void;

let latestPrices: LivePrices = {
  BTC: { bid: 0, ask: 0 },
  ETH: { bid: 0, ask: 0 },
  SOL: { bid: 0, ask: 0 },
};

const listeners = new Set<Listener>();
let initialized = false;

function emit() {
  listeners.forEach((fn) => fn(latestPrices));
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  const signaling = Signalingmanager.getInstance();
  const handler = (raw: unknown) => {
    const t = (raw || {}) as {
      symbol?: string;
      bidPrice?: number;
      askPrice?: number;
    };
    const base = String(t.symbol || "BTCUSDT").replace(
      "USDT",
      "",
    ) as BaseSymbol;

    if (!(base in latestPrices)) {
      return;
    }
    const next: LivePrices = {
      ...latestPrices,
      [base]: {
        bid: t.bidPrice ?? latestPrices[base].bid,
        ask: t.askPrice ?? latestPrices[base].ask,
      },
    };
    latestPrices = next;
    emit();
  };
  signaling.watch(Channels.BTCUSDT, handler);
  signaling.watch(Channels.ETHUSDT, handler);
  signaling.watch(Channels.SOLUSDT, handler);
}

export function subscribePrices(listener: Listener): () => void {
  ensureInitialized();
  listeners.add(listener);
  listener(latestPrices);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      // initialized = false;
    }
  };
}

export function getLatestPrices(): LivePrices {
  return latestPrices;
}
