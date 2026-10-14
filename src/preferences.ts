import { copyRules, defaultRules, guessOptions, type Rules } from './game';

export const themes = ['letterpress', 'afterhours', 'club'] as const;
export type Theme = (typeof themes)[number];
export type Preferences = { theme: Theme; rules: Rules };
export const defaults: Preferences = { theme: 'letterpress', rules: copyRules(defaultRules) };
const storageKey = 'word-practice-preferences-v1';

const fallback = (): Preferences => ({ theme: defaults.theme, rules: copyRules(defaults.rules) });
const validSeconds = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export function parsePreferences(raw: string | null): Preferences {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || !themes.includes(value.theme) || !value.rules
      || !['single', 'sequence'].includes(value.rules.format)
      || ![4, 5, 6].includes(value.rules.length)
      || !['reject', 'consume', 'fail'].includes(value.rules.invalid)) return fallback();
    // Upgrade the existing untimed storage shape without losing its choices.
    const wordClock = value.rules.wordClock === undefined ? defaults.rules.wordClock : value.rules.wordClock;
    const roundSeconds = value.rules.roundSeconds === undefined ? null : value.rules.roundSeconds;
    const maxGuesses = value.rules.maxGuesses === undefined ? defaultRules.maxGuesses : value.rules.maxGuesses;
    if (!wordClock || !['off', 'word', 'guess'].includes(wordClock.mode) || !validSeconds(wordClock.seconds)
      || (roundSeconds !== null && !validSeconds(roundSeconds)) || (maxGuesses !== null && !guessOptions.includes(maxGuesses))) return fallback();
    return {
      theme: value.theme,
      rules: {
        format: value.rules.format, length: value.rules.length, invalid: value.rules.invalid, maxGuesses,
        wordClock: { mode: wordClock.mode, seconds: wordClock.seconds }, roundSeconds,
      },
    };
  } catch {
    return fallback();
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
