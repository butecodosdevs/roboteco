const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400, w: 604_800 };

export interface DurationLimits {
  min?: number;
  max?: number;
}

export function parseDuration(
  input: string,
  { min = 60, max = 365 * 86_400 }: DurationLimits = {},
): number | undefined {
  const compact = input.toLowerCase().replace(/\s+/g, '');
  if (!/^(\d+[smhdw])+$/.test(compact)) return undefined;
  let seconds = 0;
  for (const [, amount, unit] of compact.matchAll(/(\d+)([smhdw])/g)) {
    seconds += Number(amount) * (units[unit as string] ?? 0);
  }
  return seconds >= min && seconds <= max ? seconds : undefined;
}

export const relativeTime = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:R>`;
