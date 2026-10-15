import { copyRules, defaultRules, normalizeRules, type Rules } from './game';

export const presets: readonly { key: string; label: string; rules: Rules }[] = [
  {
    key: 'practice', label: 'Practice · untimed',
    rules: copyRules(defaultRules),
  },
  {
    key: 'sequence', label: '4 → 5 → 6 · untimed',
    rules: { ...copyRules(defaultRules), format: 'sequence' },
  },
  {
    key: 'itv-four', label: 'ITV-style · 4 letters',
    rules: { ...copyRules(defaultRules), length: 4, invalid: 'fail', wordClock: { mode: 'guess', seconds: 10 } },
  },
  {
    key: 'itv-five', label: 'ITV-style · 5 letters',
    rules: { ...copyRules(defaultRules), invalid: 'fail', wordClock: { mode: 'guess', seconds: 10 } },
  },
  {
    key: 'final', label: 'Final sprint · 90 seconds',
    rules: { ...copyRules(defaultRules), format: 'sequence', invalid: 'consume', maxGuesses: null, roundSeconds: 90 },
  },
  {
    key: 'in-one', label: 'In one · 5 letters',
    rules: { ...copyRules(defaultRules), maxGuesses: 3, clue: true },
  },
];

export function sameRules(first: Rules, second: Rules): boolean {
  const [a, b] = [normalizeRules(first), normalizeRules(second)];
  return a.format === b.format && a.length === b.length && a.invalid === b.invalid && a.maxGuesses === b.maxGuesses
    && a.wordClock.mode === b.wordClock.mode && a.wordClock.seconds === b.wordClock.seconds
    && a.roundSeconds === b.roundSeconds && a.clue === b.clue;
}

export function getPresetKey(rules: Rules): string {
  return presets.find(({ rules: candidate }) => sameRules(candidate, rules))?.key ?? 'custom';
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
