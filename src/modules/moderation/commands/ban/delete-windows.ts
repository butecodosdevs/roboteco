export const deleteWindows = { none: 0, hour: 3600, day: 86_400, week: 604_800 } as const;

export type DeleteWindow = keyof typeof deleteWindows;

export const deleteWindowKeys = Object.keys(deleteWindows) as DeleteWindow[];
