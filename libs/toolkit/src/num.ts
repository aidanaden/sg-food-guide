function toSafeNumber(value: string | number, fallback = 0): number {
  const next = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(next) ? next : fallback;
}

export const Num = {
  toSafeNumber,
} as const;
