//it’s converting floating-point money into integer money for storage and computation

export const PRECISION = 10000;

//converts a price like 63,421.1234 into an integer representation (e.g. 634211234).
export function toInternalPrice(price: number | string) {
  return Math.round(parseFloat(price as any) * PRECISION);
}
//converts that integer back into a readable decimal price
export function fromInternalPrice(price: number | string | bigint) {
  return Number(price) / PRECISION;
}

