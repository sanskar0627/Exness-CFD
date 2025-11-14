import { User } from ".././types";
import { toInternalUSD, Asset } from "shared";

//Storing in In Memory right now The USer Details
export const StoreData = new Map<string, User>();
const INITIAL_BALANCE_USD: number =
  Number(process.env.INITIAL_BALANCE_USD) || 5000;
const INITIAL_BALANCE_CENTS = toInternalUSD(INITIAL_BALANCE_USD);
//I am using this map just to store email on the index so i dont have to loop  through it
const emailToUserId = new Map<string, string>();

//USer Created
export function CreateUser(userId: string, email: string, password: string) {
  const USerObj: User = {
    userId: userId,
    email: email,
    password: password,
    balance: {
      usd_balance: INITIAL_BALANCE_CENTS,
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
