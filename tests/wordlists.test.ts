import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync('vendor/esdb-2026.02.25-60-BZ5.txt');
const sourceWords = source.toString('utf8').split(/\r?\n/);

describe('static ESDB word lists', () => {
  it('uses the pinned source snapshot', () => {
    expect(createHash('sha256').update(source).digest('hex')).toBe(
      '8adc6796c1fc97ceda3d1818904dae5ca5e6bd3c129f24eb7d09ee6655433c0c',
    );
  });

  it.each([
    [4, 2640, 'play'],
    [5, 5224, 'apple'],
    [6, 8492, 'colour'],
  ])('generates the %i-letter list from the source', (length, count, example) => {
    const actual = readFileSync(join('public/words', `${length}.txt`), 'utf8').trimEnd().split('\n');
    const expected = [...new Set(sourceWords.filter((word) => /^[a-z]{4,6}$/.test(word) && word.length === length))].sort();
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(count);
    expect(actual).toContain(example);
  });

  it('keeps the upstream permission notice with the lists', () => {
    expect(readFileSync('public/words/COPYRIGHT.txt', 'utf8')).toContain(
      'Permission to use, copy, modify, distribute, and sell',
    );
  });
});
