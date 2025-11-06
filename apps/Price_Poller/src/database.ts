import { prisma } from "database";
import type { Trades } from "./binance";


export async function writeBatch(batch: Trades[]) {
  if (batch.length === 0) {
    console.log("Empty Batch Skiping to push to Database");
    return;
  }
  try {
    const pushdata = batch.map((trade) => ({
      tradeId: BigInt(trade.tradeId),
      symbol: trade.symbol,
      price: BigInt(trade.price),
      quantity: trade.quantity,
      timestamp: new Date(trade.timestamp),
    }));
    const pushResult = await prisma.trade.createMany({
        data:pushdata,
        skipDuplicates: true,
    });
    console.log(`Inserted ${pushResult.count} trades into Database`)
  } catch (err) {
    console.error("Error writing batch to database:", err);
    throw err;
  }
}
