import { calculateAllPnL } from "./pnlService";
import { getCurrentPrice } from "./priceMonitor";
import { closeOrder } from "../utils/tradeUtils";
import { getUserOrders } from "../data/store";
import { Order, reasonForClose } from "../types";
import type { CloseDecsion } from "../types";

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
    if (order.type === "buy") {
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

// Update trailing stop loss if enabled
function updateTrailingStopLoss(order: Order, currentPrice: number): void {
    if (!order.trailingStopLoss?.enabled) {
        return; // No trailing stop loss enabled
    }

    const tsl = order.trailingStopLoss;

    if (order.type === "buy") {
        // For BUY orders: Track highest price and move stop loss up
        if (!tsl.highestPrice || currentPrice > tsl.highestPrice) {
            tsl.highestPrice = currentPrice;
            const newStopLoss = currentPrice - tsl.trailingDistance;

            // Only update if new stop loss is higher (never lower)
            if (!order.stopLoss || newStopLoss > order.stopLoss) {
                order.stopLoss = newStopLoss;
                console.log(`[TSL] BUY order ${order.orderId}: Updated SL to ${newStopLoss} (highest: ${currentPrice})`);
            }
        }
    } else {
        // For SELL orders: Track lowest price and move stop loss down
        if (!tsl.lowestPrice || currentPrice < tsl.lowestPrice) {
            tsl.lowestPrice = currentPrice;
            const newStopLoss = currentPrice + tsl.trailingDistance;

            // Only update if new stop loss is lower (never higher)
            if (!order.stopLoss || newStopLoss < order.stopLoss) {
                order.stopLoss = newStopLoss;
                console.log(`[TSL] SELL order ${order.orderId}: Updated SL to ${newStopLoss} (lowest: ${currentPrice})`);
            }
        }
    }
}

export async function checkCycle():Promise<void>{
    try{
        console.log(`starting the monitoring cycle ${Date.now()}`);
        const alluser=getUserOrders("all");
        let postionChecked=0;
        let postionClsoed=0;
        let counterror=0;
        let trailingUpdates=0;
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

            // Update trailing stop loss BEFORE checking if position should close
            updateTrailingStopLoss(order, price);
            trailingUpdates++;

            //calling to check that the function  to check close Descison
            const closePosition= shouldClosePosition(order,price);
            if(closePosition=== null){
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
        console.log(`[CheckCycle] Completed: ${postionChecked} checked, ${trailingUpdates} TSL updates, ${postionClsoed} closed, ${counterror} errors`);
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

export function startPositionMonitor():void{
    if(isRunning===true){
        console.log("The position monitor is Still Running");
        return;
    }
    isRunning=true;
    console.log("Starting position monitor (checking every 5000ms)");
    setTimeout(checkCycle, 0);
}
export function stopPositionMonitor():void{
    if(isRunning===false){
        console.log("The position monitor is already stopped");
        return;
    }
    isRunning=false;
    
    // Clear timeout if exists
    if(timeoutId !== null){
        clearTimeout(timeoutId);
        timeoutId = null;
    }
    
    console.log("Position monitor stopped");
}