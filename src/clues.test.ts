import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  advanceClock, defaultRules, evaluateGuess, explainContradiction, giveUp, keyboardFeedback, nextWord, startRound, submitGuess,
  type Rules,
} from './game';
import { toRecord } from './history';
import { presets } from './presets';
import type { WordData } from './wordLists';

const data: WordData = {
  answers: { 4: ['camp'], 5: ['chair', 'cheap'], 6: ['castle'] },
  guesses: {
    4: ['camp', 'coat'],
    5: ['chair', 'cargo', 'stair', 'sheep', 'cheer', 'cabin', 'bravo', 'eerie', 'scarf', 'cheap'],
    6: ['castle', 'candle'],
  },
  clues: { 4: [], 5: [{ answer: 'chair', clues: ['cargo', 'scarf'] }, { answer: 'cheap', clues: ['eerie'] }], 6: [] },
};
const inOne: Rules = presets.find(({ key }) => key === 'in-one')!.rules;
const allowed = new Set(data.guesses[5]);
const random = () => 0;

describe('clue rounds', () => {
  it('start from a stored clue with its real feedback and no first letter', () => {
    const round = startRound(data, inOne, undefined, random, 0);
    expect(round).toMatchObject({ answer: 'chair', length: 5, wordDeadline: null, guesses: [], status: 'playing' });
    expect(round.clue).toEqual({ word: 'cargo', feedback: evaluateGuess('chair', 'cargo') });
    expect(keyboardFeedback([round.clue!])).toEqual(new Map([['c', 'correct'], ['a', 'present'], ['r', 'present'], ['g', 'absent'], ['o', 'absent']]));
    const result = submitGuess(round, 'STAIR', allowed, 1);
    expect(result.round.guesses).toEqual([{ word: 'stair', feedback: null, rejection: '1st letter must be C.' }]);
    expect(result.round.status).toBe('playing');
    expect(result.message).toBe("Rejected: STAIR doesn't fit. 1st letter must be C.");
    expect(keyboardFeedback(result.round.guesses)).toEqual(new Map());
  });

  it('solve on the answer and lose when every try is rejected', () => {
    const round = startRound(data, inOne, undefined, random, 0);
    const solved = submitGuess(submitGuess(round, 'cabin', allowed, 1).round, 'chair', allowed, 2).round;
    expect(solved).toMatchObject({ status: 'won', endedAt: 2 });
    expect(solved.guesses.map(({ word, feedback }) => [word, feedback?.length ?? null])).toEqual([['cabin', null], ['chair', 5]]);
    let lost = round;
    for (const word of ['cabin', 'cheer', 'sheep']) lost = submitGuess(lost, word, allowed, 1).round;
    expect(lost).toMatchObject({ status: 'lost', reason: 'attempts' });
    expect(lost.guesses.every(({ rejection }) => rejection)).toBe(true);
  });

  it('send unknown words through the usual policy', () => {
    const round = (invalid: Rules['invalid']) => startRound(data, { ...inOne, invalid }, undefined, random, 0);
    expect(submitGuess(round('reject'), 'zzzzz', allowed).round.guesses).toEqual([]);
    expect(submitGuess(round('consume'), 'zzzzz', allowed).round.guesses).toEqual([{ word: 'zzzzz', feedback: null }]);
    expect(submitGuess(round('fail'), 'zzzzz', allowed).round).toMatchObject({ status: 'lost', reason: 'invalid' });
  });

  it('treat a rejection as a spent attempt for per-guess time, and keep Give up for unlimited tries', () => {
    const timed = startRound(data, { ...inOne, wordClock: { mode: 'guess', seconds: 10 } }, undefined, random, 0);
    const rejected = submitGuess(timed, 'cabin', allowed, 4000).round;
    expect(rejected.wordDeadline).toBe(14000);
    expect(advanceClock(rejected, 13999).status).toBe('playing');
    const unlimited = submitGuess(startRound(data, { ...inOne, maxGuesses: null }, undefined, random, 0), 'cabin', allowed, 1).round;
    expect(giveUp(unlimited, 2)).toMatchObject({ status: 'lost', reason: 'given-up' });
  });

  it('avoid repeating the previous answer', () => {
    const round = startRound(data, inOne, undefined, random, 0);
    const lost = giveUp({ ...round, rules: { ...round.rules, maxGuesses: null } }, 1);
    expect(nextWord(lost, data, inOne, random, 2)).toMatchObject({ answer: 'cheap', clue: { word: 'eerie' } });
  });

  it('never apply to sequences, which keep the first letter', () => {
    const round = startRound(data, { ...defaultRules, format: 'sequence', clue: true }, undefined, random, 0);
    expect(round).toMatchObject({ length: 4, answer: 'camp', clue: null });
    expect(submitGuess(round, 'zoat', new Set(data.guesses[4])).message).toBe('Start with C.');
  });

  it('never use a clue another loaded guess also fits', () => {
    // CRANE fits both of CHAIR's clues, so only CHEAP's clue can be used.
    const crowded: WordData = { ...data, guesses: { ...data.guesses, 5: [...data.guesses[5], 'crane'] } };
    expect(startRound(crowded, inOne, undefined, random, 0)).toMatchObject({ answer: 'cheap', clue: { word: 'eerie' } });
    const onlyChair: WordData = { ...crowded, clues: { ...crowded.clues, 5: [crowded.clues[5][0]] } };
    expect(() => startRound(onlyChair, inOne, undefined, random, 0)).toThrow('No clue puzzles');
    const unknownAnswer: WordData = { ...data, guesses: { ...data.guesses, 5: data.guesses[5].filter((word) => word !== 'cheap') },
      clues: { ...data.clues, 5: [data.clues[5][1]] } };
    expect(() => startRound(unknownAnswer, inOne, undefined, random, 0)).toThrow('No clue puzzles');
  });

  it('record rejected tries as guesses, not unknown words, under In one', () => {
    let round = startRound(data, { ...inOne, invalid: 'consume' }, undefined, random, 0);
    for (const word of ['cabin', 'zzzzz', 'chair']) round = submitGuess(round, word, allowed, 5).round;
    expect(toRecord(round)).toMatchObject({ group: 'custom', result: 'solved', guesses: 3, unknown: 1 });
    const preset = submitGuess(startRound(data, inOne, undefined, random, 0), 'chair', allowed, 5).round;
    expect(toRecord(preset)).toMatchObject({ group: 'in-one', guesses: 1, unknown: 0 });
  });
});

describe('clue contradictions', () => {
  const clue = (answer: string, word: string) => ({ word, feedback: evaluateGuess(answer, word) });

  it('name the first broken constraint', () => {
    expect(explainContradiction(clue('chair', 'scarf'), 'cargo')).toBe('3rd letter must be A.');
    expect(explainContradiction(clue('chair', 'scarf'), 'stair')).toBe('C must appear, but not 2nd.');
    expect(explainContradiction(clue('cheap', 'eerie'), 'crane')).toBe("R isn't in the word.");
    expect(explainContradiction(clue('cheap', 'eerie'), 'sheep')).toBe('The word has only one E.');
    expect(explainContradiction(clue('cheer', 'eerie'), 'chair')).toBe('The word needs at least two Es.');
    expect(explainContradiction(clue('chair', 'cargo'), 'chair')).toBeNull();
    // An absent duplicate also rules out its own position.
    expect(explainContradiction(clue('cheap', 'eerie'), 'phone')).toBe("E can't be 5th.");
  });

  it('give a reason exactly when the feedback differs from the clue', () => {
    let fitting = 0;
    for (const length of [4, 5, 6]) {
      const words = readFileSync(`public/words/${length}.txt`, 'utf8').trim().split('\n');
      let seed = length;
      const pick = () => words[(seed = (seed * 48271) % 2147483647) % words.length];
      // Every accepted word against each sampled clue covers all fitting words and their near misses.
      for (let trial = 0; trial < 60; trial++) {
        const given = clue(pick(), pick());
        for (const word of words) {
          const fits = evaluateGuess(word, given.word).join() === given.feedback.join();
          if (fits) fitting++;
          if ((explainContradiction(given, word) === null) !== fits) expect.fail(`${given.word} → ${given.feedback} vs ${word}`);
        }
      }
    }
    expect(fitting).toBeGreaterThan(180);
  });
});
