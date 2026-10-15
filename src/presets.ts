import { copyRules, defaultRules, normalizeRules, type Rules } from './game';

type Preset = { key: string; mode: string; variant: string; label: string; rules: Rules };

/**
 * Every round is played under one of these; history groups words by their key, so keys must stay stable.
 * Presets sharing a mode are its variants (Stats tabs by mode, then variant).
 */
export const presets: readonly Preset[] = ([
  {
    key: 'practice-four', mode: 'Practice', variant: '4 letters',
    rules: { ...copyRules(defaultRules), length: 4 },
  },
  {
    key: 'practice', mode: 'Practice', variant: '5 letters',
    rules: copyRules(defaultRules),
  },
  {
    key: 'practice-six', mode: 'Practice', variant: '6 letters',
    rules: { ...copyRules(defaultRules), length: 6 },
  },
  {
    key: 'sequence', mode: 'Climb', variant: '4 → 5 → 6',
    rules: { ...copyRules(defaultRules), format: 'sequence' },
  },
  {
    key: 'quickfire-four', mode: 'Quickfire', variant: '4 letters',
    rules: { ...copyRules(defaultRules), length: 4, invalid: 'fail', wordClock: { mode: 'guess', seconds: 10 } },
  },
  {
    key: 'quickfire-five', mode: 'Quickfire', variant: '5 letters',
    rules: { ...copyRules(defaultRules), invalid: 'fail', wordClock: { mode: 'guess', seconds: 10 } },
  },
  {
    key: 'sprint', mode: 'Sprint', variant: '90 seconds',
    rules: { ...copyRules(defaultRules), format: 'sequence', invalid: 'consume', maxGuesses: null, roundSeconds: 90 },
  },
  {
    key: 'in-one', mode: 'In one', variant: '5 letters',
    rules: { ...copyRules(defaultRules), maxGuesses: 1, clue: true },
  },
] satisfies Omit<Preset, 'label'>[]).map((preset) => ({ ...preset, label: `${preset.mode} · ${preset.variant}` }));

/** Mode names in preset order. */
export const modes: readonly string[] = [...new Set(presets.map(({ mode }) => mode))];

export function sameRules(first: Rules, second: Rules): boolean {
  const [a, b] = [normalizeRules(first), normalizeRules(second)];
  return a.format === b.format && a.length === b.length && a.invalid === b.invalid && a.maxGuesses === b.maxGuesses
    && a.wordClock.mode === b.wordClock.mode && a.wordClock.seconds === b.wordClock.seconds
    && a.roundSeconds === b.roundSeconds && a.clue === b.clue;
}

export const defaultPreset = 'practice';

export const isPresetKey = (key: unknown): key is string => presets.some((preset) => preset.key === key);

export function presetLabel(key: string): string {
  return presets.find((preset) => preset.key === key)?.label ?? key;
}

/** A fresh copy of a preset's rules; unknown keys fall back to the default preset. */
export function presetRules(key: string): Rules {
  return copyRules((presets.find((preset) => preset.key === key) ?? presets.find((preset) => preset.key === defaultPreset)!).rules);
}

/** The preset these rules belong to, or null for rules no preset uses. */
export function getPresetKey(rules: Rules): string | null {
  return presets.find(({ rules: candidate }) => sameRules(candidate, rules))?.key ?? null;
}

export function describeRules(rules: Rules): string {
  const parts = [
    rules.format === 'sequence' ? '4 → 5 → 6 sequence' : `${rules.length} letters`,
    ...(normalizeRules(rules).clue ? ['Starts with a clue only the answer fits; no first letter'] : []),
    rules.maxGuesses === null ? 'Unlimited guesses per word' : `${rules.maxGuesses} ${rules.maxGuesses === 1 ? 'guess' : 'guesses'} per word`,
  ];
  if (rules.wordClock.mode !== 'off') parts.push(`${rules.wordClock.seconds} seconds per ${rules.wordClock.mode}`);
  if (rules.roundSeconds !== null && rules.format === 'sequence') parts.push(`${rules.roundSeconds} seconds overall`);
  if (rules.wordClock.mode === 'off' && (rules.format !== 'sequence' || rules.roundSeconds === null)) parts.push('Untimed');
  parts.push(({ reject: 'Unknown words are free to reject', consume: rules.maxGuesses === null ? 'Unknown words are unscored' : 'Unknown words use a guess', fail: 'Unknown words end the word' })[rules.invalid]);
  return parts.join(' · ');
}
