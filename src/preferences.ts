import type { Rules } from './game';

export const themes = ['letterpress', 'afterhours', 'club'] as const;
export type Theme = (typeof themes)[number];
export type Preferences = { theme: Theme; rules: Rules };
export const defaults: Preferences = { theme: 'letterpress', rules: { format: 'single', length: 5, invalid: 'reject' } };
const storageKey = 'word-practice-preferences-v1';

export function parsePreferences(raw: string | null): Preferences {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || !themes.includes(value.theme) || !value.rules
      || !['single', 'sequence'].includes(value.rules.format)
      || ![4, 5, 6].includes(value.rules.length)
      || !['reject', 'fail'].includes(value.rules.invalid)) return { theme: defaults.theme, rules: { ...defaults.rules } };
    return { theme: value.theme, rules: { format: value.rules.format, length: value.rules.length, invalid: value.rules.invalid } };
  } catch {
    return { theme: defaults.theme, rules: { ...defaults.rules } };
  }
}

export function loadPreferences(): Preferences {
  if (typeof window === 'undefined') return parsePreferences(null);
  try { return parsePreferences(window.localStorage.getItem(storageKey)); }
  catch { return parsePreferences(null); }
}

export function savePreferences(value: Preferences): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(storageKey, JSON.stringify(value)); }
  catch { /* Play remains available when storage is blocked or full. */ }
}
