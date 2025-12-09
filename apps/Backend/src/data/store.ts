import { Order, User, ClosedOrder, PriceData } from ".././types";
import { toInternalUSD, Asset, SUPPORTED_ASSETS } from "shared";

//Storing in In Memory right now The USer Details
export const StoreData = new Map<string, User>();
const INITIAL_BALANCE_USD: number =
  Number(process.env.INITIAL_BALANCE_USD) || 50000;
const INITIAL_BALANCE_CENTS = toInternalUSD(INITIAL_BALANCE_USD);
// Email to UserId mapping for fast lookup - exported for state restoration
export const emailToUserId = new Map<string, string>();
export const orderStorageMap = new Map<string, Map<string, Order>>(); // Order Storage map
export const ClosedStorageMap = new Map<string, Map<string, ClosedOrder>>(); // Closed order Storage map
export const PriceStorageMp = new Map<Asset, PriceData>(); // Stores the PRices of BTC<ETH AND SOL realtime  for liquidation and logic calucltion
// Initialize PRICESTORE with default values
SUPPORTED_ASSETS.forEach((asset) => {
  PriceStorageMp.set(asset, { bid: 0, ask: 0 }); //Without this, if someone tries to get BTC price, they'll get undefined! initilizing with zero to evey coin
});

//USer Created
export function CreateUser(userId: string, email: string, password: string, balanceCents?: number) {
  const USerObj: User = {
    userId: userId,
    email: email,
    password: password,
    balance: {
      usd_balance: balanceCents !== undefined ? balanceCents : INITIAL_BALANCE_CENTS,
    },
    assets: {} as Record<Asset, number>,
  };
  StoreData.set(userId, USerObj);
  emailToUserId.set(email, userId);
  return USerObj;
}
export function findUser(email: string): User | undefined {
  const USer = emailToUserId.get(email); //
  if (!USer) {
    console.log("No User Found !!!!!!!!");
    return undefined;
  } else {
    const user = StoreData.get(USer);
    return user;
  }
}

//Find USer By its ID and returning the user
export function findUSerId(ID: string): User | undefined {
  const checkUser = StoreData.get(ID);
  if (!checkUser) {
    console.log(`The User with ${ID} does not exist`);
    return undefined;
  } else {
    return checkUser;
  }
}

//to Update User Balance
export function UserBalance(userId: string, UserBalance: number): void {
  const ValidUSer = StoreData.get(userId);
  if (ValidUSer) {
    ValidUSer.balance.usd_balance = UserBalance;
    console.log(
      `The User with ${userId} HAs sucesfully  Updated his Balance to ${UserBalance}`
    );
  } else {
    console.log(`The User with ${userId} does not exist`);
  }
}

// Update user's cryptocurrency asset holdings for buy/sell operations to track crypto positions

export function UpdateUserAsset(
  userId: string,
  asset: Asset,
  quantity: number
): void {
  const user = StoreData.get(userId);
  if (user) {
    const previousQuantity = user.assets[asset] || 0;
    user.assets[asset] = quantity;
    console.log(
      `[ASSET UPDATE] User ${userId} | Asset: ${asset} | Previous: ${previousQuantity} | New: ${quantity} | Change: ${quantity - previousQuantity}`
    );
  } else {
    console.log(`[ASSET UPDATE FAILED] User with ${userId} does not exist`);
  }
}

// Get user's current holdings for a specific cryptocurrency asset  Returns 0 if user doesn't own any of the asset

export function GetUserAsset(userId: string, asset: Asset): number {
  const user = StoreData.get(userId);
  if (!user) {
    console.log(`[GET ASSET] User with ${userId} does not exist - returning 0`);
    return 0;
  }
  const quantity = user.assets[asset] || 0;
  console.log(
    `[GET ASSET] User ${userId} | Asset: ${asset} | Holdings: ${quantity}`
  );
  return quantity;
}
export function getUserOrders(userId: string): Map<string, Order> {
  // Special case: "all" returns combined orders from all users
  if (userId === "all") {
    const allOrders = new Map<string, Order>();
    orderStorageMap.forEach((userOrders) => {
      userOrders.forEach((order, orderId) => {
        allOrders.set(orderId, order);
      });
    });
    return allOrders;
  }
  
  const result = orderStorageMap.get(userId); //check user exsist
  if (!result) {
    orderStorageMap.set(userId, new Map<string, Order>());
  }
  return orderStorageMap.get(userId)!;
}

export function getUserCloseOrders(userId: string): Map<string, ClosedOrder> {
  // Special case: "all" returns combined orders from all users
  if (userId === "all") {
    const allOrders = new Map<string, ClosedOrder>();
    ClosedStorageMap.forEach((userOrders) => {
      userOrders.forEach((order, orderId) => {
        allOrders.set(orderId, order);
      });
    });
    return allOrders;
  }
  
  const result = ClosedStorageMap.get(userId); //To check user exsist
  if (!result) {
    ClosedStorageMap.set(userId, new Map<string, ClosedOrder>());
  }
  return ClosedStorageMap.get(userId)!;
}

