export function bahtToSatang(value: number | string): number {
  const asNumber = typeof value === "string" ? Number(value || 0) : value;
  return Math.round(asNumber * 100);
}

export function satangToBaht(value: number): number {
  return value / 100;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

export function formatQuantity(value: number, displayFactor = 1, unit = "ชิ้น"): string {
  const shown = value / displayFactor;
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 }).format(shown)} ${unit}`;
}
