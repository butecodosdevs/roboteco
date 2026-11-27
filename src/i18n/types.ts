import type { enUS } from './locales/en-US';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

export type Messages = Shape<typeof enUS>;

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

type Prefixes<K> = K extends `${infer P}.name` ? P : never;

export type LocalizablePrefix = Prefixes<MessageKey>;

export type Vars = Record<string, string | number>;
