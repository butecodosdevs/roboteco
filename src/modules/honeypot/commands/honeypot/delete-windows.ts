export const deleteWindows = { none: 0, hour: 3600, day: 86_400, week: 604_800 } as const;

export type DeleteWindow = keyof typeof deleteWindows;

export const windowKeys = Object.keys(deleteWindows) as DeleteWindow[];

export const windowFor = (seconds: number): DeleteWindow =>
  windowKeys.find((w) => deleteWindows[w] === seconds) ?? 'hour';
