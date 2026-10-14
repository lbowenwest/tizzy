import { describe, expect, it } from 'vitest';
import { giveUp, defaultRules, evaluateGuess, keyboardFeedback, isSequenceComplete, nextWord, startRound, submitGuess, type Rules } from './game';
import type { WordData } from './wordLists';

const data: WordData = {
  answers: { 4: ['camp', 'coat'], 5: ['chair', 'clean'], 6: ['castle'] },
  guesses: { 4: ['camp', 'coat', 'care'], 5: ['chair', 'clean', 'cargo'], 6: ['castle', 'candle'] },
};
const rules: Rules = { ...defaultRules };
const allowed = new Set(data.guesses[5]);
const random = () => 0;

describe('keyboard letter knowledge', () => {
  it('keeps correct above present above absent, regardless of duplicate or guess order', () => {
    const guesses = ['cargo', 'civic'].map((word) => ({ word, feedback: evaluateGuess('chair', word) }));
    const expected = new Map([
      ['c', 'correct'], ['a', 'present'], ['r', 'present'], ['g', 'absent'],
      ['o', 'absent'], ['i', 'correct'], ['v', 'absent'],
    ]);
    expect(keyboardFeedback(guesses)).toEqual(expected);
    expect(keyboardFeedback([...guesses].reverse())).toEqual(expected);
    expect(keyboardFeedback([{ word: 'cacca', feedback: evaluateGuess('cacao', 'cacca') }]))
      .toEqual(new Map([['c', 'correct'], ['a', 'correct']]));
  });
  it('does not infer any letter knowledge from unscored guesses', () => {
    expect(keyboardFeedback([]).size).toBe(0);
    expect(keyboardFeedback([{ word: 'czzzz', feedback: null }]).size).toBe(0);
  });
  it('does not gray out correct or misplaced letters with extra unmatched copies', () => {
    for (const [answer, word] of [['chair', 'civic'], ['cacao', 'cacca']]) {
      const knowledge = keyboardFeedback([{ word, feedback: evaluateGuess(answer, word) }]);
      for (const letter of answer) expect(knowledge.get(letter)).not.toBe('absent');
    }
  });
});

describe('untimed round controller', () => {
  it('gives up an unlimited word without spending a guess or changing checked feedback', () => {
    const initial = startRound(data, { ...rules, maxGuesses: null }, undefined, random);
    const guessed = submitGuess(initial, 'cargo', allowed).round;
    const abandoned = giveUp(guessed, 12345);
    expect(abandoned).toMatchObject({ status: 'lost', reason: 'given-up', answer: 'chair', endedAt: 12345 });
    expect(abandoned.guesses).toBe(guessed.guesses);
    expect(guessed.status).toBe('playing');
    expect(submitGuess(abandoned, 'chair', allowed).round).toBe(abandoned);
    expect(nextWord(abandoned, data, rules, random)).toMatchObject({ status: 'playing', guesses: [], answer: 'clean', rules });
  });
  it('does not give up limited or already ended words', () => {
    const limited = startRound(data, rules, undefined, random);
    expect(giveUp(limited)).toBe(limited);
    const unlimited = startRound(data, { ...rules, maxGuesses: null }, undefined, random);
    const won = submitGuess(unlimited, 'chair', allowed).round;
    expect(giveUp(won)).toBe(won);
    const lost = giveUp(unlimited);
    expect(giveUp(lost)).toBe(lost);
  });
  it.each([4, 5, 6] as const)('giving up a sequence word retries length %i with the same rules', (length) => {
    const config: Rules = { ...rules, format: 'sequence', maxGuesses: null };
    let round = startRound(data, config, undefined, random);
    while (round.length < length) {
      round = submitGuess(round, round.answer, new Set(data.guesses[round.length])).round;
      round = nextWord(round, data, rules, random);
    }
    round = giveUp(round);
    expect(isSequenceComplete(round)).toBe(false);
    expect(nextWord(round, data, { ...rules, maxGuesses: 3 }, random))
      .toMatchObject({ length, status: 'playing', guesses: [], rules: config });
  });
  it.each([1, 3, 6, 10])('uses a %i-guess budget for accepted and consumed unknown guesses', (maxGuesses) => {
    let round = startRound(data, { ...rules, maxGuesses, invalid: 'consume' }, undefined, random);
    for (let index = 0; index < maxGuesses; index++) {
      round = submitGuess(round, index % 2 ? 'cargo' : 'czzzz', allowed).round;
      expect(round.status).toBe(index === maxGuesses - 1 ? 'lost' : 'playing');
    }
    expect(round.guesses).toHaveLength(maxGuesses);
    expect(submitGuess(round, 'chair', allowed).round).toBe(round);
  });
  it.each([1, 6])('allows a solve on the final of %i guesses and leaves free rejections unspent', (maxGuesses) => {
    let round = startRound(data, { ...rules, maxGuesses }, undefined, random);
    expect(submitGuess(round, 'czzzz', allowed).round).toBe(round);
    expect(submitGuess(round, 'cha', allowed).round).toBe(round);
    for (let index = 0; index < maxGuesses - 1; index++) round = submitGuess(round, 'cargo', allowed).round;
    round = submitGuess(round, 'chair', allowed).round;
    expect(round.status).toBe('won');
    expect(round.guesses).toHaveLength(maxGuesses);
  });
  it('keeps a sequence guess budget through retries and advances until a new round', () => {
    const config = { ...rules, format: 'sequence' as const, maxGuesses: 1 };
    let round = startRound(data, config, undefined, random);
    config.maxGuesses = 8;
    round = submitGuess(round, 'coat', new Set(data.guesses[4])).round;
    expect(round.status).toBe('lost');
    round = nextWord(round, data, config, random);
    expect(round.rules.maxGuesses).toBe(1);
    for (const length of [4, 5, 6] as const) {
      round = submitGuess(round, round.answer, new Set(data.guesses[length])).round;
      if (length !== 6) round = nextWord(round, data, config, random);
    }
    expect(nextWord(round, data, config, random).rules.maxGuesses).toBe(8);
  });
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
  it('can spend an attempt on an unknown word without revealing letter feedback', () => {
    const initial = startRound(data, { ...rules, invalid: 'consume' }, undefined, random);
    const { round, message } = submitGuess(initial, 'CZZZZ', allowed);
    expect(round).toMatchObject({ status: 'playing', guesses: [{ word: 'czzzz', feedback: null }] });
    expect(message).toContain('Guess used');
    expect(keyboardFeedback(round.guesses).size).toBe(0);
    expect(initial.guesses).toHaveLength(0);
    expect(submitGuess(round, 'chair', allowed).round.status).toBe('won');
  });
  it('does not spend an attempt on malformed input under the consume policy', () => {
    const round = startRound(data, { ...rules, invalid: 'consume' }, undefined, random);
    for (const word of ['czz', 'czzzzz', 'zzzzz']) expect(submitGuess(round, word, allowed).round).toBe(round);
  });
  it('counts unknown and accepted words against the same five-attempt budget', () => {
    let round = startRound(data, { ...rules, invalid: 'consume' }, undefined, random);
    for (let index = 0; index < 5; index++) round = submitGuess(round, index % 2 ? 'cargo' : 'czzzz', allowed).round;
    expect(round).toMatchObject({ status: 'lost', reason: 'attempts' });
    expect(round.guesses).toHaveLength(5);
    expect(keyboardFeedback(round.guesses)).toEqual(new Map([['c', 'correct'], ['a', 'present'], ['r', 'present'], ['g', 'absent'], ['o', 'absent']]));
  });
  it('retries the same sequence length after five unknown words', () => {
    const sequence: Rules = { ...rules, format: 'sequence', invalid: 'consume' };
    let round = startRound(data, sequence, undefined, random);
    for (let index = 0; index < 5; index++) round = submitGuess(round, 'czzz', new Set(data.guesses[4])).round;
    expect(round).toMatchObject({ status: 'lost', reason: 'attempts' });
    expect(round.guesses).toHaveLength(5);
    expect(nextWord(round, data, rules, random)).toMatchObject({ length: 4, status: 'playing', guesses: [], rules: sequence });
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
