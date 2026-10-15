import { describe, expect, it } from 'vitest';
import { analyseFinishedWord } from './analysis';
import { defaultRules, evaluateGuess, startRound, submitGuess, type Round } from './game';
import type { WordData } from './wordLists';

const data: WordData = {
  answers: { 4: ['bake', 'bale', 'bane', 'bare', 'care'], 5: ['belle', 'belly', 'bells', 'belie'], 6: [] },
  guesses: { 4: ['bake', 'bale', 'bane', 'bare', 'bark', 'care'], 5: ['belle', 'belly', 'bells', 'belie'], 6: [] },
  clues: { 4: [], 5: [], 6: [] },
};
function finished(answer: string, words: string[]): Round {
  return {
    ...startRound(data, { ...defaultRules, length: answer.length as 4 | 5 }, undefined, () => 0, 0),
    answer, status: 'lost', endedAt: 1,
    guesses: words.map((word) => ({ word, feedback: evaluateGuess(answer, word) })),
  };
}
function information(round: Round) {
  const result = analyseFinishedWord(round, data);
  expect(result?.kind).toBe('information');
  if (result?.kind !== 'information') throw new Error('Expected information analysis');
  return result.guesses;
}

describe('finished-word information analysis', () => {
  it('keeps analysis unavailable during play', () => {
    expect(analyseFinishedWord(startRound(data, { ...defaultRules, length: 4 }), data)).toBeNull();
  });

  it('measures expected information before seeing the result, using answers and legal probes', () => {
    const [guess] = information(finished('bale', ['bake']));
    expect(guess.before).toBe(4); // CARE has the wrong supplied first letter; BARK is only a guess.
    expect(guess.after).toBe(3);
    expect(guess.remaining).toEqual(['bale', 'bane', 'bare']);
    expect(guess.value?.bits).toBeCloseTo(0.811278);
    expect(guess.value?.expectedRemaining).toBe(2.5);
    expect(guess.value?.solveChance).toBe(0.25);
    expect(guess.bestBits).toBeCloseTo(1.5);
    expect(guess.alternatives).toContainEqual({ word: 'bark', bits: 1.5, expectedRemaining: 1.5, solveChance: 0 });
    expect(guess.alternatives.every(({ word }) => word.startsWith('b'))).toBe(true);
    const [lucky] = information(finished('bake', ['bake']));
    expect(lucky.value).toEqual(guess.value);
    expect(lucky.alternatives).toEqual(guess.alternatives);
    expect(lucky.after).toBe(1);
  });

  it('replays exact duplicate-aware feedback and never uses future guesses to grade a choice', () => {
    const round = finished('belly', ['belle', 'belly']);
    const [first, second] = information(round);
    expect(first.before).toBe(4);
    expect(first.after).toBe(2);
    expect(first.remaining).toEqual(['belly', 'bells']);
    expect(second.before).toBe(2);
    expect(second.after).toBe(1);
    expect(second.remaining).toEqual(['belly']);
    expect(second.value?.bits).toBe(1);
    expect(second.value?.solveChance).toBe(0.5);
    expect(first).toEqual(information(finished('belly', ['belle']))[0]);
  });

  it('gives repeats zero information and treats solving a known answer as certain, not a bad guess', () => {
    const [, second, repeat, solve] = information(finished('belly', ['belle', 'bells', 'belle', 'belly']));
    expect(second.after).toBe(1);
    expect(repeat.value).toMatchObject({ bits: 0, expectedRemaining: 1, solveChance: 0 });
    expect(solve.value).toMatchObject({ bits: 0, expectedRemaining: 1, solveChance: 1 });
    expect(solve.bestBits).toBe(0);
    expect(solve.alternatives).toEqual([]);
    const repeated = information(finished('bale', ['bake', 'bake']));
    expect(repeated[1]).toMatchObject({ before: 3, after: 3, value: { bits: 0 } });
  });

  it('keeps unscored attempts in place without treating them as letter evidence', () => {
    const round = finished('bale', ['bake']);
    round.guesses.unshift({ word: 'bzzz', feedback: null });
    const [unknown, scored] = information(round);
    expect(unknown).toMatchObject({ before: 4, after: 4, value: null, alternatives: [] });
    expect(scored.before).toBe(4);
    expect(information({ ...round, guesses: [] })).toEqual([]);
  });

  it('marks the last available attempt without pretending entropy is a solve strategy', () => {
    const round = finished('bale', ['bark']);
    round.rules = { ...round.rules, maxGuesses: 1 };
    expect(information(round)[0]).toMatchObject({ lastTry: true, value: { solveChance: 0 } });
  });

  it('explains clue puzzles instead of rating their zero remaining uncertainty', () => {
    const clueData: WordData = {
      answers: { ...data.answers, 5: ['chair'] },
      guesses: { ...data.guesses, 5: ['chair', 'cargo', 'stair'] },
      clues: { ...data.clues, 5: [{ answer: 'chair', clues: ['cargo'] }] },
    };
    const initial = startRound(clueData, { ...defaultRules, clue: true, maxGuesses: 1 }, undefined, () => 0);
    const rejected = submitGuess(initial, 'stair', new Set(clueData.guesses[5])).round;
    expect(analyseFinishedWord(rejected, clueData)).toMatchObject({
      kind: 'clue', word: 'cargo', answer: 'chair',
      explanations: [{ word: 'stair', reason: '1st letter must be C.' }],
    });
  });
});
