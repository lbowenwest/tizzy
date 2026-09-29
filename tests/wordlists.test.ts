import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readList = (path: string) => readFileSync(path, 'utf8').trimEnd().split('\n');
const guessSource = readFileSync('vendor/esdb-2026.02.25-60-BZ5.txt');
const tierSource = readFileSync('vendor/esdb-2026.02.25-sizes.txt');
const guessSourceWords = guessSource.toString('utf8').split(/\r?\n/);
const tiers = new Map(
  tierSource.toString('utf8').split(/\r?\n/).filter(Boolean).map((line) => line.split('\t') as [string, string]),
);
const excluded = new Set(readList('data/excluded-answers.txt'));

describe('static ESDB word lists', () => {
  it('uses the pinned source snapshots', () => {
    expect(createHash('sha256').update(guessSource).digest('hex')).toBe(
      '8adc6796c1fc97ceda3d1818904dae5ca5e6bd3c129f24eb7d09ee6655433c0c',
    );
    expect(createHash('sha256').update(tierSource).digest('hex')).toBe(
      'd5dd185fe19c6ae66d21f37d039d74fb6983c347c0086962c7b4c21bdbc16860',
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
    [4, 1864, 'play'],
    [5, 3469, 'apple'],
    [6, 5316, 'colour'],
  ])('curates %i-letter answers from the common tier', (length, count, example) => {
    const answers = readList(join('public/words/answers', `${length}.txt`));
    const guesses = new Set(readList(join('public/words', `${length}.txt`)));
    const expected = [...tiers]
      .filter(([word, size]) => word.length === length && Number(size) <= 35)
      .map(([word]) => word)
      .filter((word) => guesses.has(word) && !excluded.has(word))
      .sort();

    expect(answers).toEqual(expected);
    expect(answers).toHaveLength(count);
    expect(answers.every((word) => guesses.has(word))).toBe(true);
    expect(answers).toContain(example);
  });

  it('keeps every curated answer out of the excluded list', () => {
    for (const length of [4, 5, 6]) {
      const answers = readList(join('public/words/answers', `${length}.txt`));
      expect(answers.filter((word) => excluded.has(word))).toEqual([]);
    }
  });

  it('keeps the upstream permission notice with the lists', () => {
    expect(readFileSync('public/words/COPYRIGHT.txt', 'utf8')).toContain(
      'Permission to use, copy, modify, distribute, and sell',
    );
  });
});
