import { expect, it } from 'vitest';
import { defaultRules, startRound, submitGuess } from './game';
import { analyseFinishedWord } from './analysis';
import type { WordData } from './wordLists';

const data: WordData = {
  answers: { 4: ['bale', 'care'], 5: [], 6: [] },
  guesses: { 4: ['bale', 'care'], 5: [], 6: [] },
  clues: { 4: [], 5: [], 6: [] },
};
it('accepts any starting letter without a supplied hint, and analysis starts with the whole answer pool', () => {
  const rules = { ...defaultRules, length: 4 as const, firstLetter: false };
  let round = startRound(data, rules, undefined, () => 0, 1000);
  round = submitGuess(round, 'care', new Set(data.guesses[4]), 2000).round;
  expect(round.guesses).toHaveLength(1);
  round = submitGuess(round, 'bale', new Set(data.guesses[4]), 3000).round;
  const analysis = analyseFinishedWord(round, data);
  expect(analysis?.kind === 'information' && analysis.guesses[0].before).toBe(2);
});
