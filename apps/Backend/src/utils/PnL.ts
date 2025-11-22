import { OrderType } from "../types";

export function calculatePnLCents( //calculation of normal profit and loss 
  openPrice: number,
  closePrice: number,
  marginCent: number,
  leverage: number,
  side: OrderType
): number {
  let profitandLoss: bigint = BigInt(0);
  const op = BigInt(openPrice); // current oprn price
  const cp = BigInt(closePrice); // current clode price
  const mc = BigInt(marginCent);
  const lg = BigInt(leverage);
  const PositionValue = mc * lg; // postion value is basiaclly purcahsing powwer  (margin × leverage)
  //Caluclating price diffrence
  const buyPrice: bigint = cp - op; //// Profit/Loss for LONG (buy) positions
  const sellPrice: bigint = op - cp; // // Profit/Loss for Short  (sell) positions

  if (side === "buy") {
    //means we are calulating for long
    profitandLoss = (PositionValue * buyPrice) / op;
  } else if (side === "sell") {//we are calculating for the short
    profitandLoss = (PositionValue * sellPrice) / op;
  }

  return Number(profitandLoss);
}

// calultion of liuidadtion price
export function calculateLiquidation(openPrice:number,leverage:number,side:OrderType):number{
const op = BigInt(openPrice);
const lg = BigInt(leverage);
let liqudationPrice:bigint = BigInt(0);
if (side === "buy") {
    //means we are calulating for long
    liqudationPrice = (op*(lg-BigInt(1))/lg);
  } else if (side === "sell") {//we are calculating for the short
    liqudationPrice = (op*(lg+BigInt(1))/lg);
  }

  return Number(liqudationPrice);
}
