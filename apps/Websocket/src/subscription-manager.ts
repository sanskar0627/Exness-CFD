import { Asset, SUPPORTED_ASSETS } from "shared";
import { randomUUID } from "crypto";
import type {
  ClientMessage,
  PriceUpdate,
  ServerMessage,
  ClientInfo,
} from "./types";

export class SubscriptionManager {
  clients: Map<WebSocket, ClientInfo> = new Map(); //stores ALL client data , when u have Ws and need all the Client INFO
  clientSubscriptions: Map<string, Set<Asset>> = new Map(); //Need to check/update a specific client's subscriptions
  assetSubscribers: Map<Asset, Set<string>> = new Map(); // to get all the info about  client who has SUB to specifc coins
  clientIdToWebSocket: Map<string, WebSocket> = new Map(); // Fast lookup: clientId → WebSocket

  //Adding The Client
  addClient(ws: WebSocket): void {
    const subscriptions = new Set<Asset>();
    const clientInfo: ClientInfo = {
      id: randomUUID(),
      subscriptions: subscriptions,
      connectedAt: new Date(),
    };
    this.clients.set(ws, clientInfo);
    this.clientSubscriptions.set(clientInfo.id, subscriptions);
    this.clientIdToWebSocket.set(clientInfo.id, ws);
    console.log(
      `Client ${clientInfo.id} connected. Total clients: ${this.clients.size}`
    );
  }

  //Remove client
  removeClient(ws: WebSocket): void {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) {
      console.log("Attempted to remove non-existent client!!!!!");
      return;
    }
    for (const asset of clientInfo.subscriptions) {
      const subscribers = this.assetSubscribers.get(asset);
      if (subscribers) {
        subscribers.delete(clientInfo.id);
        if (subscribers.size === 0) {
          this.assetSubscribers.delete(asset);
        }
      }
    }
    this.clientSubscriptions.delete(clientInfo.id);
    this.clientIdToWebSocket.delete(clientInfo.id);
    this.clients.delete(ws);
    console.log(`Client ${clientInfo.id} disconnected. Was subscribed to
  ${clientInfo.subscriptions.size} assets. Remaining clients: ${this.clients.size}`);
  }

  //subscribinng the client
  subscribeClient(ws: WebSocket, asset: Asset): void {
    const clientInfo = this.clients.get(ws);
    //check for the client
    if (!clientInfo) {
      console.log("Client Not Exsited!!!!!");
      return;
    }
    //checking Assets is not duplicated and has support Asset list
    if (!SUPPORTED_ASSETS.includes(asset)) {
      console.log(`Invalid Asset : - ${asset} `);
      return;
    }
    //Duplication check like if the user is already subscribe to that coin so no need
    if (clientInfo.subscriptions.has(asset)) {
      console.log(`Client ${clientInfo.id} is already subscribed to ${asset}`);
      return;
    }

    //adding it to subscription
    clientInfo.subscriptions.add(asset);
    if (!this.assetSubscribers.has(asset)) {
      this.assetSubscribers.set(asset, new Set());
    }
    this.assetSubscribers.get(asset)!.add(clientInfo.id);
    console.log(`Client ${clientInfo.id} subscribed to ${asset}`);
  }

  //Unsubscribe
  unsubscribeClient(ws: WebSocket, asset: Asset): void {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) {
      console.log("Client Not Exsited!!!!!");
      return;
    }
    if (!SUPPORTED_ASSETS.includes(asset)) {
      console.log(`Invalid Asset : - ${asset} `);
      return;
    }
    if (!clientInfo.subscriptions.has(asset)) {
      console.log(`Client ${clientInfo.id} was not subscribed to ${asset}`);
      return;
    }
    clientInfo.subscriptions.delete(asset);

    const issubscribers = this.assetSubscribers.get(asset);
    if (issubscribers) {
      issubscribers.delete(clientInfo.id);
      console.log(`Client ${clientInfo.id} Removed from ${asset}`);
      if (issubscribers.size === 0) {
        this.assetSubscribers.delete(asset);
      }
    }
    if (!issubscribers) {
      console.log(
        "Warning: Asset not found in assetSubscribers - data inconsistency!"
      );
    }
  }

  //Broadcasting
  broadcast(asset: Asset, message: ServerMessage): void {
    if (!SUPPORTED_ASSETS.includes(asset)) {
      console.log(`Invalid Asset : - ${asset} `);
      return;
    }
    const clientSub = this.assetSubscribers.get(asset);
    if (!clientSub) {
      console.log("No Client has subscribed it");
      return;
    }
    const strServerMessage = JSON.stringify(message);

    for (const clientId of clientSub) {
      const ws = this.clientIdToWebSocket.get(clientId);
      try {
        if (ws) {
          ws.send(strServerMessage);
        }
      } catch (err) {
        console.error(`Failed to send to client ${clientId}:`, err);
      }
    }
    console.log(
      `Broadcast to ${clientSub.size} clients subscribed to ${asset}`
    );
  }
}
