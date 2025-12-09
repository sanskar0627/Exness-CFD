import { OrderType } from "../types";

export function calculatePnLCents( //calculation of normal profit and loss
  openPrice: number,
  closePrice: number,
  marginCent: number,
  leverage: number,
  side: OrderType
): number {
  // CRITICAL: Convert margin from USD_SCALE (100) to PRICE_SCALE (10000) for accurate calculation
  // This ensures margin and prices are on the same scale
  const MONEY_SCALE = 100n;
  const PRICE_SCALE = 10000n;
  const CONVERSION_FACTOR = PRICE_SCALE / MONEY_SCALE; // = 100

  let profitandLoss: bigint = BigInt(0);
  const op = BigInt(Math.round(openPrice)); // current open price
  const cp = BigInt(Math.round(closePrice)); // current close price
  const mc = BigInt(Math.round(marginCent)); // margin in cents
  const lg = BigInt(Math.round(leverage));

  // Convert margin to PRICE_SCALE first
  const marginOnPriceScale = mc * CONVERSION_FACTOR;
  const PositionValue = marginOnPriceScale * lg; // position value (margin × leverage)

  //Calculating price difference
  const buyPrice: bigint = cp - op; // Profit/Loss for LONG (buy) positions
  const sellPrice: bigint = op - cp; // Profit/Loss for SHORT (sell) positions

  if (side === "buy") {
    // Calculating for long
    profitandLoss = (PositionValue * buyPrice) / op;
  } else if (side === "sell") {
    // Calculating for short
    profitandLoss = (PositionValue * sellPrice) / op;
  }

  // Convert back from PRICE_SCALE to USD_SCALE (cents)
  const finalPnL = profitandLoss / CONVERSION_FACTOR;

  return Number(finalPnL);
}

// Calculation of liquidation price
export function calculateLiquidation(openPrice:number,leverage:number,side:OrderType):number{
const op = BigInt(Math.round(openPrice));
const lg = BigInt(Math.round(leverage));
let liquidationPrice:bigint = BigInt(0);
if (side === "buy") {
    //means we are calculating for long
    liquidationPrice = (op*(lg-BigInt(1))/lg);
  } else if (side === "sell") {//we are calculating for the short
    liquidationPrice = (op*(lg+BigInt(1))/lg);
  }

  return Number(liquidationPrice);
}
