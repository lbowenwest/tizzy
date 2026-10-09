import { describe, expect, it } from 'vitest';
import { evaluateGuess, isSequenceComplete, nextWord, startRound, submitGuess, unavailableLetters, type Rules } from './game';
import type { WordData } from './wordLists';

const data: WordData = {
  answers: { 4: ['camp', 'coat'], 5: ['chair', 'clean'], 6: ['castle'] },
  guesses: { 4: ['camp', 'coat', 'care'], 5: ['chair', 'clean', 'cargo'], 6: ['castle', 'candle'] },
};
const rules: Rules = { format: 'single', length: 5, invalid: 'reject' };
const allowed = new Set(data.guesses[5]);
const random = () => 0;

describe('keyboard letter knowledge', () => {
  it('starts empty and accumulates only letters with no positive feedback', () => {
    expect(unavailableLetters([])).toEqual(new Set());
    const guesses = ['cargo', 'civic'].map((word) => ({ word, feedback: evaluateGuess('chair', word) }));
    expect(unavailableLetters(guesses)).toEqual(new Set(['g', 'o', 'v']));
    expect(unavailableLetters([...guesses].reverse())).toEqual(new Set(['g', 'o', 'v']));
  });
  it('does not gray out correct or misplaced letters with extra unmatched copies', () => {
    for (const [answer, word] of [['chair', 'civic'], ['cacao', 'cacca']]) {
      const unavailable = unavailableLetters([{ word, feedback: evaluateGuess(answer, word) }]);
      for (const letter of answer) expect(unavailable.has(letter)).toBe(false);
    }
  });
});

describe('untimed round controller', () => {
  it('consumes exact letters before misplaced letters and never overcounts duplicates', () => {
    expect(evaluateGuess('cacao', 'cacca')).toEqual(['correct', 'correct', 'correct', 'absent', 'present']);
    expect(evaluateGuess('array', 'alarm')).toEqual(['correct', 'absent', 'present', 'present', 'absent']);
    expect(evaluateGuess('chair', 'chair')).toEqual(Array(5).fill('correct'));
  });
  it('accepts uppercase input and ends on a solve', () => {
    const initial = startRound(data, rules, undefined, random);
    const { round } = submitGuess(initial, 'CHAIR', allowed);
    expect(round.status).toBe('won');
    expect(initial.guesses).toHaveLength(0);
    expect(submitGuess(round, 'cargo', allowed).round).toBe(round);
  });
  it('rejects incomplete and wrong-first-letter input without consuming a guess', () => {
    const round = startRound(data, rules, undefined, random);
    for (const word of ['cha', '1hair', 'chairs', 'apple']) {
      expect(submitGuess(round, word, allowed).round).toBe(round);
    }
  });
  it('rejects unknown words or fails the word according to the snapshotted policy', () => {
    const reject = startRound(data, rules, undefined, random);
    expect(submitGuess(reject, 'czzzz', allowed).round).toBe(reject);
    const fail = startRound(data, { ...rules, invalid: 'fail' }, undefined, random);
    expect(submitGuess(fail, 'czzzz', allowed).round).toMatchObject({ status: 'lost', reason: 'invalid', guesses: [] });
  });
  it('fails after five valid wrong guesses, then starts afresh without an immediate repeat', () => {
    let round = startRound(data, rules, undefined, random);
    for (let guess = 0; guess < 5; guess++) round = submitGuess(round, 'cargo', allowed).round;
    expect(round).toMatchObject({ status: 'lost', reason: 'attempts' });
    expect(round.guesses).toHaveLength(5);
    const next = nextWord(round, data, rules, random);
    expect(next).toMatchObject({ answer: 'clean', guesses: [], status: 'playing' });
  });
  it('snapshots rules and uses changed settings only when a new round starts', () => {
    const mutable = { ...rules };
    const round = startRound(data, mutable, undefined, random);
    mutable.length = 6;
    expect(round.rules.length).toBe(5);
    const solved = submitGuess(round, 'chair', allowed).round;
    expect(nextWord(solved, data, mutable, random).length).toBe(6);
  });
  it('replaces failed sequence words at the same length and advances only on a solve', () => {
    const sequence: Rules = { ...rules, format: 'sequence', invalid: 'fail' };
    let round = startRound(data, sequence, undefined, random);
    expect(round.length).toBe(4);
    round = submitGuess(round, 'czzz', new Set(data.guesses[4])).round;
    round = nextWord(round, data, rules, random);
    expect(round.length).toBe(4);
    expect(round.rules.format).toBe('sequence');
    for (const length of [4, 5, 6] as const) {
      expect(round.length).toBe(length);
      round = submitGuess(round, round.answer, new Set(data.guesses[length])).round;
      if (length !== 6) round = nextWord(round, data, rules, random);
    }
    expect(isSequenceComplete(round)).toBe(true);
    expect(nextWord(round, data, rules, random).rules.format).toBe('single');
  });
  it.each([4, 5, 6] as const)('a failed sequence word retries length %i', (length) => {
    const sequence: Rules = { ...rules, format: 'sequence', invalid: 'fail' };
    let round = startRound(data, sequence, undefined, random);
    while (round.length < length) {
      round = submitGuess(round, round.answer, new Set(data.guesses[round.length])).round;
      round = nextWord(round, data, rules, random);
    }
    round = submitGuess(round, 'c' + 'z'.repeat(length - 1), new Set(data.guesses[length])).round;
    expect(nextWord(round, data, rules, random)).toMatchObject({ length, status: 'playing', guesses: [], rules: sequence });
  });
  it('uses a one-word pool safely and refuses to advance an active word', () => {
    const round = startRound(data, { ...rules, length: 6 }, 'castle', random);
    expect(round.answer).toBe('castle');
    expect(nextWord(round, data, rules)).toBe(round);
    expect(() => startRound({ ...data, answers: { ...data.answers, 6: [] } }, { ...rules, length: 6 })).toThrow('No answers');
  });
});
