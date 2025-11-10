import type { Asset } from "shared";

// Re-export Asset for convenience
export type { Asset };

//Messages clients send to the server
export type ClientMessage =
  | { type: "SUBSCRIBE"; symbol: Asset }
  | { type: "UNSUBSCRIBE"; symbol: Asset }
  | { type: "PING" };

export interface PriceUpdate {
  symbol: Asset;
  bidPrice: number;
  askPrice: number;
  decimals: number;
  time: number;
}

//Messages server sends to clients
export type ServerMessage =
  | { type: "PRICE_UPDATE"; data: PriceUpdate }
  | { type: "ERROR"; message: string }
  | { type: "SUBSCRIBED"; symbol: Asset }
  | { type: "UNSUBSCRIBED"; symbol: Asset }
  | { type: "PONG" };

//Metadata about a connected client
export interface ClientInfo {
  id: string;
  subscriptions: Set<Asset>; // Which symbols they're tracking
  connectedAt: Date;
}
