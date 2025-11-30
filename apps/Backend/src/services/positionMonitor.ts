import { calculateAllPnL } from "./pnlService";
import { getCurrentPrice } from "./priceMonitor";
import { closeOrder } from "../utils/tradeUtils";
import { getUserOrders } from "../data/store";
import { Order, reasonForClose } from "../types";
import type { CloseDecsion } from "../types";
import { ConnectionTimeoutError } from "redis";

//setiing global varibale to chekc the state of the ongoing process
let isRunning = false;
let timeoutId: NodeJS.Timeout | null = null;
const CHECK_INTERVAL = 5000;
let lastCheckTime = 0;

export function shouldClosePosition(
    order: Order,
    currentPrice: number
): CloseDecsion | null {
    //for Liquidation for buy price when price is going down
    if (order.type == "buy") {
        if (currentPrice <= order.liquidationPrice) {
            const sendreason: CloseDecsion = {
                reason: "liquidation",
                price: currentPrice,
            };
            return sendreason;
        }
    } else {
        //for short when price is going up Liquidadtion triggers ordertypee is sell emand it short
        if (currentPrice >= order.liquidationPrice) {
            const sendreason: CloseDecsion = {
                reason: "liquidation",
                price: currentPrice,
            };
            return sendreason;
        }
    }

        //  Check Stop Loss
    if (order.stopLoss) {
        if (order.type === "buy") {
            // Long: SL triggers when price goes DOWN
            if (currentPrice <= order.stopLoss) {
                return {
                    reason: "stop_loss",
                    price: currentPrice,
                };
            }
        } else {
            //  StopLoss triggers when price goes UP
            if (currentPrice >= order.stopLoss) {
                return {
                    reason: "stop_loss",
                    price: currentPrice,
                };
            }
        }
    }

    //  Check Take Profit
    if (order.takeProfit) {
        if (order.type === "buy") {
            // Long: TP triggers when price goes UP
            if (currentPrice >= order.takeProfit) {
                return {
                    reason: "take_profit",
                    price: currentPrice,
                };
            }
        } else {
            // TakeProfit triggers when price goes DOWN
            if (currentPrice <= order.takeProfit) {
                return {
                    reason: "take_profit",
                    price: currentPrice,
                };
            }
        }
    }

    
    return null;
}

export async function checkCycle():Promise<void>{
    try{
        console.log(`starting the monitoring cycle ${Date.now()}`);
        const time=new Date();
        const alluser=getUserOrders("all");
        let postionChecked=0;
        let postionClsoed=0;
        let counterror=0;
        let price:number =0;
        //lopp through each order
        for (const[orderId,order] of alluser.entries()){
            postionChecked++;
            const UserAsset=await getCurrentPrice(order.asset);
            if(!UserAsset){
                console.log("[checkcyle]the User Dont have  orderPrice ");
                continue;
            }
            if(order.type==='buy'){
                 price=UserAsset.bidPrice;
            }else if(order.type==="sell"){
                 price=UserAsset.askPrice;
            }
            //calling to check that the function  to check close Descison 
            const closePosition= shouldClosePosition(order,price);
            if(closePosition=== null){
                console.log("[Close Decion] No details About closing the Position");
                continue;
            }
            else{
                try{
                await closeOrder(order.userId,orderId,closePosition.price,closePosition.reason)
                postionClsoed++;
                }catch(err){
                    counterror++;
                    console.error('the erro cooured while closing the order',err)
                }
            }

        }
        
        // Log cycle stats
        console.log(`[CheckCycle] Completed: ${postionChecked} checked, ${postionClsoed} closed, ${counterror} errors`);
        lastCheckTime = Date.now();
        
        // Schedule next cycle
        if (isRunning) {
            timeoutId = setTimeout(checkCycle, CHECK_INTERVAL);
        }
    }catch(err){
        console.error("[CheckCycle} error coming while cheking It",err);
        
        // Schedule next cycle even after error
        if (isRunning) {
            timeoutId = setTimeout(checkCycle, CHECK_INTERVAL);
        }
    }
}