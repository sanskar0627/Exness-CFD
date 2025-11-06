import { startBinance } from "./binance";
import { kafkaproduce } from "./kafka-producer";
import { consumer_gr } from "./kafka-consumer";
import { startRedis } from "./redish-publisher";

export async function startTrade() {
   await startRedis();   
  await kafkaproduce(); 
  consumer_gr();        
  startBinance();       
}
