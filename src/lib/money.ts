export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: number, symbol = "$") {
  const n = roundMoney(value);
  const abs = Math.abs(n).toFixed(2);
  return n < 0 ? `-${symbol}${abs}` : `${symbol}${abs}`;
}
