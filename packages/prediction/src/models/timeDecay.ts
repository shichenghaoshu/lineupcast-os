export interface TimeDecayOptions {
  asOfDate?: string | Date;
  halfLifeDays?: number;
}

export function toDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${String(value)}`);
  return date;
}

export function timeDecayWeight(matchDate: string | Date, options: TimeDecayOptions = {}): number {
  const asOf = toDate(options.asOfDate ?? new Date());
  const match = toDate(matchDate);
  const halfLifeDays = options.halfLifeDays ?? 180;
  if (halfLifeDays <= 0) throw new Error("halfLifeDays must be positive");

  const ageDays = Math.max(0, (asOf.getTime() - match.getTime()) / 86_400_000);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

export function weightedAverage(values: Array<{ value: number; weight: number }>, fallback = 0): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return fallback;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}
