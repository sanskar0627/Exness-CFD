import type { Trade } from "../components/AskBidsTable";

const url = import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:8080";

export class Signalingmanager {
  private ws: WebSocket;
  private static instance: Signalingmanager;
  private bufferedMessage: Record<string, unknown>[] = [];
  private initialized: boolean = false;
  private callbacks: { [symbol: string]: Array<(...args: Trade[]) => void> } =
    {};
  private subCount: Record<string, number> = {};

  private constructor() {
    this.ws = new WebSocket(url);
    this.bufferedMessage = [];
    this.init();
  }

  private send(msg: Record<string, unknown>) {
    if (!this.initialized) {
      this.bufferedMessage.push(msg);
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  public watch(symbol: string, callback: (trade: Trade) => void): () => void {
    this.callbacks[symbol] = this.callbacks[symbol] || [];
    this.callbacks[symbol].push(callback);

    const prev = this.subCount[symbol] ?? 0;
    this.subCount[symbol] = prev + 1;
    if (prev === 0) {
      this.send({ type: "SUBSCRIBE", symbol });
    }

    return () => {
      this.unwatch(symbol, callback);
    };
  }

  private unwatch(symbol: string, callback: (trade: Trade) => void) {
    const list = this.callbacks[symbol] || [];
    this.callbacks[symbol] = list.filter((cb) => cb !== callback);

    if (this.callbacks[symbol].length === 0) {
      delete this.callbacks[symbol];
    }

    const cur = this.subCount[symbol] ?? 0;
    if (cur <= 1) {
      delete this.subCount[symbol];
      this.send({ type: "UNSUBSCRIBE", symbol });
    } else {
      this.subCount[symbol] = cur - 1;
    }
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new Signalingmanager();
    }
    return this.instance;
  }

  private init() {
    this.ws.onopen = () => {
      this.initialized = true;

      Object.keys(this.subCount).forEach((sym) => {
        if (this.subCount[sym] > 0) {
          this.ws.send(JSON.stringify({ type: "SUBSCRIBE", symbol: sym }));
        }
      });

      this.bufferedMessage.forEach((msg) => {
        this.ws.send(JSON.stringify(msg));
      });
      this.bufferedMessage = [];

      console.log("WebSocket connected");
    };

    this.ws.onmessage = (msg) => {
      const raw = msg.data;
      const parsedMsg = JSON.parse(raw);
      
      // Handle PRICE_UPDATE messages - symbol is in data object
      if (parsedMsg.type === "PRICE_UPDATE" && parsedMsg.data) {
        const symbol = parsedMsg.data.symbol;
        if (this.callbacks[symbol]) {
          const callbacksCopy = [...this.callbacks[symbol]];
          callbacksCopy.forEach((callback) => {
            callback(parsedMsg.data);
          });
        }
      }
      // Handle other messages - symbol is at top level
      else if (parsedMsg.symbol) {
        const symbol = parsedMsg.symbol;
        if (this.callbacks[symbol]) {
          const callbacksCopy = [...this.callbacks[symbol]];
          callbacksCopy.forEach((callback) => {
            callback(parsedMsg);
          });
        }
      }
    };

    this.ws.onerror = (err) => {
      console.error(" WebSocket error:", err);
    };

    this.ws.onclose = () => {
      console.log(" WebSocket disconnected, reconnecting...");
      this.initialized = false;
      setTimeout(() => {
        this.ws = new WebSocket(url);
        this.init();
      }, 5000);
    };
  }

  registerCallback(symbol: string, callback: (...args: Trade[]) => void) {
    if (!this.callbacks[symbol]) {
      this.callbacks[symbol] = [];
    }
    this.callbacks[symbol].push(callback);
  }

  deregisterCallback(symbol: string) {
    if (this.callbacks[symbol]) {
      delete this.callbacks[symbol];
    }
  }

  public subscribe(message: Record<string, unknown>) {
    this.send(message);
  }

  deregisterCallbackNew(symbol: string, callback: (...args: Trade[]) => void) {
    if (this.callbacks[symbol]) {
      this.callbacks[symbol] = this.callbacks[symbol].filter(
        (cb) => cb !== callback,
      );
      if (this.callbacks[symbol].length === 0) {
        delete this.callbacks[symbol];
      }
    }
  }

  public getActiveSubscriptions() {
    return {
      callbacks: Object.keys(this.callbacks),
      subCounts: { ...this.subCount },
    };
  }
}
