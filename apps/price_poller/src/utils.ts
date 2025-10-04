export const PRECISION = 10000;

export function toInternalPrice(price: number | string) {
  return Math.round(parseFloat(price as any) * PRECISION);
}

export function fromInternalPrice(price: number | string | bigint) {
  return Number(price) / PRECISION;
}
