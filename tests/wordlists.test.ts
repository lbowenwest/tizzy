import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateGuess } from '../src/game';

const feedbackKey = (answer: string, word: string) =>
  evaluateGuess(answer, word).reduce((key, mark) => key * 3 + (mark === 'correct' ? 2 : mark === 'present' ? 1 : 0), 0);
const readList = (path: string) => readFileSync(path, 'utf8').trimEnd().split('\n');
const guessSource = readFileSync('vendor/esdb-2026.02.25-60-BZ5.txt');
const tierSource = readFileSync('vendor/esdb-2026.02.25-sizes.txt');
const guessSourceWords = guessSource.toString('utf8').split(/\r?\n/);
const tiers = new Map(
  tierSource.toString('utf8').split(/\r?\n/).filter(Boolean).map((line) => line.split('\t') as [string, string]),
);
const excluded = new Set(readList('data/excluded-answers.txt'));
const pluralSource = readFileSync('vendor/esdb-2026.02.25-plural-nouns.txt');
const pluralNouns = new Set(readList('vendor/esdb-2026.02.25-plural-nouns.txt'));

describe('static ESDB word lists', () => {
  it('uses the pinned source snapshots', () => {
    expect(createHash('sha256').update(guessSource).digest('hex')).toBe(
      '8adc6796c1fc97ceda3d1818904dae5ca5e6bd3c129f24eb7d09ee6655433c0c',
    );
    expect(createHash('sha256').update(tierSource).digest('hex')).toBe(
      'd5dd185fe19c6ae66d21f37d039d74fb6983c347c0086962c7b4c21bdbc16860',
    );
    expect(createHash('sha256').update(pluralSource).digest('hex')).toBe(
      '612b7950b8d8954fd7ccf43976a23ed49dd0b1f1054c2e77d37c5220557d741f',
    );
  });

  it.each([
    [4, 2640, 'play'],
    [5, 5224, 'apple'],
    [6, 8492, 'colour'],
  ])('generates the %i-letter guess list from the size 60 source', (length, count, example) => {
    const actual = readList(join('public/words', `${length}.txt`));
    const expected = [...new Set(guessSourceWords.filter((word) => /^[a-z]{4,6}$/.test(word) && word.length === length))].sort();
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(count);
    expect(actual).toContain(example);
  });

  it.each([
    [4, 1748, 'play'],
    [5, 3115, 'apple'],
    [6, 4761, 'colour'],
  ])('curates %i-letter answers from the common tier', (length, count, example) => {
    const answers = readList(join('public/words/answers', `${length}.txt`));
    const guesses = new Set(readList(join('public/words', `${length}.txt`)));
    const expected = [...tiers]
      .filter(([word, size]) => word.length === length && Number(size) <= 35)
      .map(([word]) => word)
      .filter((word) => guesses.has(word) && !excluded.has(word) && !pluralNouns.has(word))
      .sort();

    expect(answers).toEqual(expected);
    expect(answers).toHaveLength(count);
    expect(answers.every((word) => guesses.has(word))).toBe(true);
    expect(answers).toContain(example);
  });

  it('removes regular and irregular plural-only nouns from answers, not guesses', () => {
    for (const word of ['cats', 'mice', 'geese', 'teeth', 'feet', 'knives', 'ladies']) {
      expect(pluralNouns.has(word)).toBe(true);
      expect(readList(`public/words/answers/${word.length}.txt`)).not.toContain(word);
      expect(readList(`public/words/${word.length}.txt`)).toContain(word);
    }
    for (const length of [4, 5, 6]) {
      expect(readList(`public/words/answers/${length}.txt`).filter((word) => pluralNouns.has(word))).toEqual([]);
    }
  });

  it('preserves verbs, mixed noun/verb forms and non-plural words ending in s', () => {
    for (const word of ['gives', 'parks', 'leaves', 'reads', 'jumps', 'runs', 'dogs', 'glass', 'news', 'series', 'sheep']) {
      expect(pluralNouns.has(word)).toBe(false);
      expect(readList(`public/words/answers/${word.length}.txt`)).toContain(word);
    }
  });

  it('keeps every curated answer out of the excluded list', () => {
    for (const length of [4, 5, 6]) {
      const answers = readList(join('public/words/answers', `${length}.txt`));
      expect(answers.filter((word) => excluded.has(word))).toEqual([]);
    }
  });

  it.each([
    [4, 1363],
    [5, 2833],
    [6, 4643],
  ])('gives %i-letter answers up to three familiar, non-giveaway clues', (length, count) => {
    const answers = new Set(readList(`public/words/answers/${length}.txt`));
    const lines = readList(`public/words/clues/${length}.txt`).map((line) => line.split(' '));
    expect(lines).toHaveLength(count);
    expect(lines.map(([answer]) => answer)).toEqual([...new Set(lines.map(([answer]) => answer))].sort());
    for (const [answer, ...clues] of lines) {
      expect(answers.has(answer)).toBe(true);
      expect(clues.length).toBeGreaterThanOrEqual(1);
      expect(clues.length).toBeLessThanOrEqual(3);
      expect(new Set(clues).size).toBe(clues.length);
      for (const clue of clues) {
        expect(clue).not.toBe(answer);
        expect(answers.has(clue)).toBe(true);
        expect(evaluateGuess(answer, clue).filter((mark) => mark === 'correct').length).toBeLessThanOrEqual(Math.floor(length / 2));
      }
    }
  });

  it.each([4, 5, 6])('gives every %i-letter clue exactly one fitting accepted guess: its answer', (length) => {
    const accepted = readList(`public/words/${length}.txt`);
    const answersByClue = new Map<string, string[]>();
    for (const [answer, ...clues] of readList(`public/words/clues/${length}.txt`).map((line) => line.split(' '))) {
      for (const clue of clues) answersByClue.set(clue, [...(answersByClue.get(clue) ?? []), answer]);
    }
    const ambiguous: string[] = [];
    for (const [clue, clueAnswers] of answersByClue) {
      const fits = new Map<number, number>();
      for (const word of accepted) {
        const key = feedbackKey(word, clue);
        fits.set(key, (fits.get(key) ?? 0) + 1);
      }
      for (const answer of clueAnswers) {
        if (fits.get(feedbackKey(answer, clue)) !== 1) ambiguous.push(`${answer} ${clue}`);
      }
    }
    expect(ambiguous).toEqual([]);
  }, 60_000);

  it('keeps the upstream permission notice with the lists', () => {
    expect(readFileSync('public/words/COPYRIGHT.txt', 'utf8')).toContain(
      'Permission to use, copy, modify, distribute, and sell',
    );
  });
});
