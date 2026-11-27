import { Locale, type LocalizationMap } from 'discord.js';
import { enUS } from './locales/en-US';
import { ptBR } from './locales/pt-BR';
import type { LocalizablePrefix, MessageKey, Messages, Vars } from './types';

export type { MessageKey, Messages, Vars } from './types';

export const defaultLocale = Locale.EnglishUS;

const locales: Partial<Record<Locale, Messages>> = {
  [Locale.EnglishUS]: enUS,
  [Locale.PortugueseBR]: ptBR,
};

function lookup(messages: Messages, key: MessageKey): string | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function t(locale: Locale | string, key: MessageKey, vars?: Vars): string {
  const messages = locales[locale as Locale] ?? locales[defaultLocale] ?? enUS;
  const text = lookup(messages, key) ?? lookup(enUS, key) ?? key;
  return interpolate(text, vars);
}

export function translator(locale: Locale | string) {
  return (key: MessageKey, vars?: Vars) => t(locale, key, vars);
}

/** Excludes the default locale, which builders take via `setName` / `setDescription`. */
export function localizations(key: MessageKey): LocalizationMap {
  const map: LocalizationMap = {};
  for (const [locale, messages] of Object.entries(locales) as [Locale, Messages][]) {
    if (locale === defaultLocale) continue;
    const text = lookup(messages, key);
    if (text) map[locale] = text;
  }
  return map;
}

interface Localizable {
  setName(name: string): unknown;
  setNameLocalizations(localizations: LocalizationMap | null): unknown;
  setDescription(description: string): unknown;
  setDescriptionLocalizations(localizations: LocalizationMap | null): unknown;
}

export function localize<B extends Localizable>(builder: B, prefix: LocalizablePrefix): B {
  const name = `${prefix}.name` as MessageKey;
  const description = `${prefix}.description` as MessageKey;
  builder.setName(t(defaultLocale, name));
  builder.setNameLocalizations(localizations(name));
  builder.setDescription(t(defaultLocale, description));
  builder.setDescriptionLocalizations(localizations(description));
  return builder;
}

interface NameLocalizable {
  setName(name: string): unknown;
  setNameLocalizations(localizations: LocalizationMap | null): unknown;
}

export function localizeName<B extends NameLocalizable>(builder: B, key: MessageKey): B {
  builder.setName(t(defaultLocale, key));
  builder.setNameLocalizations(localizations(key));
  return builder;
}
