import { describe, expect, it } from 'vitest';
import { advanceClock, copyRules, giveUp, nextWord, startRound, submitGuess, type Rules, type WordLength } from './game';
import { addRecord, parseHistory, summarizeHistory, toRecord, type HistoryRecord } from './history';
import { presets } from './presets';
import type { WordData } from './wordLists';

const data: WordData = {
  answers: { 4: ['camp'], 5: ['chair'], 6: ['castle'] },
  guesses: { 4: ['camp', 'coat'], 5: ['chair', 'cargo'], 6: ['castle', 'candle'] },
  clues: { 4: [], 5: [], 6: [] },
};
const allowed = (length: WordLength) => new Set(data.guesses[length]);
const preset = (key: string) => copyRules(presets.find((entry) => entry.key === key)!.rules);
const start = (rules: Rules) => startRound(data, rules, undefined, () => 0, 1000);
const make = (endedAt: number, changes: Partial<HistoryRecord> = {}): HistoryRecord => ({
  id: `${endedAt}:chair`, roundId: endedAt, answer: 'chair', length: 5, format: 'single', group: 'practice',
  result: 'solved', reason: null, guesses: 3, unknown: 0, durationMs: 1000, endedAt, ...changes,
});

describe('history records', () => {
  it('records each kind of finished word with its result and preset group', () => {
    let solved = submitGuess(start(preset('practice')), 'cargo', allowed(5), 2000).round;
    solved = submitGuess(solved, 'chair', allowed(5), 4000).round;
    expect(toRecord(solved)).toEqual({
      id: '1000:chair', roundId: 1000, answer: 'chair', length: 5, format: 'single', group: 'practice',
      result: 'solved', reason: null, guesses: 2, unknown: 0, durationMs: 3000, endedAt: 4000,
    });
    let exhausted = start(preset('practice'));
    for (let index = 0; index < 5; index++) exhausted = submitGuess(exhausted, 'cargo', allowed(5), 2000 + index * 1000).round;
    expect(toRecord(exhausted)).toMatchObject({ result: 'failed', reason: 'attempts', guesses: 5 });
    expect(toRecord(submitGuess(start(preset('itv-five')), 'czzzz', allowed(5), 2000).round))
      .toMatchObject({ group: 'itv-five', result: 'failed', reason: 'invalid', guesses: 0 });
    expect(toRecord(advanceClock(start(preset('itv-four')), 11000)))
      .toMatchObject({ group: 'itv-four', answer: 'camp', reason: 'word-time', durationMs: 10000 });
    expect(toRecord(advanceClock(start(preset('final')), 91000)))
      .toMatchObject({ group: 'final', format: 'sequence', reason: 'round-time' });
    const unknown = submitGuess(start(preset('final')), 'czzz', allowed(4), 2000).round;
    expect(toRecord(giveUp(unknown, 3000))).toMatchObject({ reason: 'given-up', guesses: 1, unknown: 1, durationMs: 2000 });
    const custom = submitGuess(start({ ...preset('practice'), maxGuesses: 6 }), 'chair', allowed(5), 2000).round;
    expect(toRecord(custom)).toMatchObject({ group: 'custom', result: 'solved' });
  });
  it('does not record a word still in play', () => {
    expect(toRecord(start(preset('practice')))).toBeNull();
    expect(toRecord(submitGuess(start(preset('practice')), 'cargo', allowed(5), 2000).round)).toBeNull();
  });
  it('upserts by word, replacing a failed sequence word with its later round expiry', () => {
    const rules = { ...preset('sequence'), invalid: 'fail' as const, roundSeconds: 10 };
    const failed = submitGuess(start(rules), 'czzz', allowed(4), 2000).round;
    const once = addRecord([], toRecord(failed)!);
    expect(addRecord(once, toRecord(failed)!)).toEqual(once);
    const expired = addRecord(once, toRecord(advanceClock(failed, 11000))!);
    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({ id: once[0].id, result: 'failed', reason: 'round-time', endedAt: 11000 });
    const retry = advanceClock(nextWord(failed, data, rules, () => 0, 5000), 11000);
    expect(toRecord(retry)).toMatchObject({ id: '5000:camp', roundId: 1000, reason: 'round-time' });
  });
  it('keeps the newest 1,000 records in finish order', () => {
    expect(addRecord([make(5)], make(3)).map(({ endedAt }) => endedAt)).toEqual([3, 5]);
    let records: HistoryRecord[] = [];
    for (let endedAt = 1; endedAt <= 1001; endedAt++) records = addRecord(records, make(endedAt));
    expect(records).toHaveLength(1000);
    expect(records[0].endedAt).toBe(2);
    expect(records[999].endedAt).toBe(1001);
  });
});

describe('history summary', () => {
  it('derives totals, guess distribution, streaks and average solve time per group', () => {
    const summary = summarizeHistory([
      make(4, { guesses: 3, durationMs: 2000 }),
      make(1, { guesses: 3, durationMs: 1000 }),
      make(2, { result: 'failed', reason: 'attempts', guesses: 5 }),
      make(3, { guesses: 2, durationMs: 3000 }),
      make(5, { group: 'itv-five', result: 'failed', reason: 'invalid', guesses: 0 }),
    ]);
    expect(summary.get('practice')).toEqual({
      played: 4, solved: 3, guessDistribution: [{ guesses: 2, count: 1 }, { guesses: 3, count: 2 }],
      currentStreak: 2, bestStreak: 2, averageSolveMs: 2000, rounds: null,
    });
    expect(summary.get('itv-five')).toMatchObject({ played: 1, solved: 0, currentStreak: 0, bestStreak: 0, averageSolveMs: null });
    expect(summarizeHistory([]).size).toBe(0);
  });
  it('keeps the best streak after a failure resets the current one', () => {
    const results = ['solved', 'solved', 'solved', 'failed', 'solved'] as const;
    const records = results.map((result, index) => make(index + 1, result === 'failed' ? { result, reason: 'attempts' } : {}));
    expect(summarizeHistory(records).get('practice')).toMatchObject({ currentStreak: 1, bestStreak: 3 });
  });
  it('counts completed and expired sequence rounds, not words', () => {
    const sequence = (endedAt: number, roundId: number, length: WordLength, changes: Partial<HistoryRecord> = {}) =>
      make(endedAt, { group: 'final', format: 'sequence', roundId, length, answer: data.answers[length][0], ...changes });
    const summary = summarizeHistory([
      sequence(1, 1, 4), sequence(2, 1, 5), sequence(3, 1, 6),
      sequence(4, 2, 4, { result: 'failed', reason: 'attempts' }), sequence(5, 2, 4, { result: 'failed', reason: 'round-time' }),
      sequence(6, 3, 4),
      make(7, { group: 'custom', length: 6, answer: 'castle' }),
      make(8, { group: 'custom', format: 'sequence', roundId: 8, result: 'failed', reason: 'round-time' }),
    ]);
    expect(summary.get('final')).toMatchObject({ played: 6, rounds: { completed: 1, expired: 1 } });
    expect(summary.get('custom')).toMatchObject({ played: 2, rounds: { completed: 0, expired: 1 } });
  });
});

describe('history storage parsing', () => {
  it('restores valid records in finish order without arbitrary fields', () => {
    const records = [make(2), make(1)];
    expect(parseHistory(JSON.stringify({ version: 1, records: [...records, { ...make(3), extra: true }] })))
      .toEqual([make(1), make(2), make(3)]);
  });
  it('drops malformed records individually', () => {
    const records = [make(1), { ...make(2), answer: 'CHAIR' }, { ...make(3), reason: 'attempts' },
      { ...make(4), result: 'failed', reason: 'unknown' }, { ...make(5), unknown: 9 }, { ...make(6), length: 7 },
      { ...make(7), group: '' }, { ...make(8), durationMs: -1 }, null, 'chair'];
    expect(parseHistory(JSON.stringify({ version: 1, records }))).toEqual([make(1)]);
  });
  it('recovers from missing, corrupt and other-version storage', () => {
    for (const raw of [null, '{', 'true', '[]', '{"version":2,"records":[]}', '{"version":1}']) {
      expect(parseHistory(raw)).toEqual([]);
    }
  });
});
