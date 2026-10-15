import { defaultRules, type Rules } from './game';
import { defaultPreset, getPresetKey, isPresetKey } from './presets';

export const themes = ['letterpress', 'afterhours', 'club'] as const;
export type Theme = (typeof themes)[number];
export type Preferences = { theme: Theme; preset: string };
export const defaults: Preferences = { theme: 'letterpress', preset: defaultPreset };
const storageKey = 'word-practice-preferences-v1';

/** Older storage saved whole rules; keep the preset they match, filling fields added since with their old defaults. */
function legacyPreset(rules: Partial<Rules>): string {
  try { return getPresetKey({ ...defaultRules, roundSeconds: null, ...rules }) ?? defaultPreset; }
  catch { return defaultPreset; } // Malformed fields, such as a null clock.
}

export function parsePreferences(raw: string | null): Preferences {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return { ...defaults };
    const theme = themes.includes(value.theme) ? value.theme : defaults.theme;
    if (isPresetKey(value.preset)) return { theme, preset: value.preset };
    return { theme, preset: value.rules && typeof value.rules === 'object' ? legacyPreset(value.rules) : defaultPreset };
  } catch {
    return { ...defaults };
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
