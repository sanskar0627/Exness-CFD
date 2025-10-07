import prisma from "./dbconfig.js";

export async function saveTradeBatch(trades: any[]) {
  // if nothing to insert.
  if (!trades.length) return;
  try {
    //insert multiple (rows) records  at once  and skip duplicacy
    const res = await prisma.trade.createMany({
      data: trades,
      skipDuplicates: true,
    });
    console.log(`Saved ${res.count} trades`);
  } catch (e) {
    console.error("DB batch save error:", e);
  }
}
