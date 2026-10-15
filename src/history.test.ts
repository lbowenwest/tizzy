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
    expect(toRecord(submitGuess(start(preset('quickfire-five')), 'czzzz', allowed(5), 2000).round))
      .toMatchObject({ group: 'quickfire-five', result: 'failed', reason: 'invalid', guesses: 0 });
    expect(toRecord(advanceClock(start(preset('quickfire-four')), 11000)))
      .toMatchObject({ group: 'quickfire-four', answer: 'camp', reason: 'word-time', durationMs: 10000 });
    expect(toRecord(advanceClock(start(preset('sprint')), 91000)))
      .toMatchObject({ group: 'sprint', format: 'sequence', reason: 'round-time' });
    const unknown = submitGuess(start(preset('sprint')), 'czzz', allowed(4), 2000).round;
    expect(toRecord(giveUp(unknown, 3000))).toMatchObject({ reason: 'given-up', guesses: 1, unknown: 1, durationMs: 2000 });
    // Rules no preset uses have no group, so they are not recorded.
    const custom = submitGuess(start({ ...preset('practice'), maxGuesses: 6 }), 'chair', allowed(5), 2000).round;
    expect(toRecord(custom)).toBeNull();
  });
  it('does not record a word still in play', () => {
    expect(toRecord(start(preset('practice')))).toBeNull();
    expect(toRecord(submitGuess(start(preset('practice')), 'cargo', allowed(5), 2000).round)).toBeNull();
  });
  it('upserts by word, so a later result for the same word replaces the earlier one', () => {
    const failed = make(2, { format: 'sequence', group: 'sprint', result: 'failed', reason: 'attempts' });
    const once = addRecord([], failed);
    expect(addRecord(once, failed)).toEqual(once);
    expect(addRecord(once, { ...failed, reason: 'round-time', endedAt: 11 })).toEqual([{ ...failed, reason: 'round-time', endedAt: 11 }]);
  });
  it('keeps the round id across a sequence retry', () => {
    // Giving up pauses the final's clock, so 89 seconds remain after the retry starts.
    const retry = nextWord(giveUp(start(preset('sprint')), 2000), data, preset('sprint'), () => 0, 5000);
    expect(toRecord(advanceClock(retry, 95000))).toMatchObject({ id: '5000:camp', roundId: 1000, reason: 'round-time' });
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
      make(5, { group: 'quickfire-five', result: 'failed', reason: 'invalid', guesses: 0 }),
    ]);
    expect(summary.get('practice')).toEqual({
      played: 4, solved: 3, distribution: {
        by: 'guesses', latest: 2,
        rows: [...[0, 1, 2, 0, 0].map((count, index) => ({ mark: String(index + 1), label: `${index + 1} ${index ? 'guesses' : 'guess'}`, count })),
          { mark: '✗', label: 'Not solved', count: 1 }],
      },
      currentStreak: 2, bestStreak: 2, averageSolveMs: 2000, rounds: null,
    });
    expect(summary.get('quickfire-five')).toMatchObject({ played: 1, solved: 0, currentStreak: 0, bestStreak: 0, averageSolveMs: null });
    expect(summarizeHistory([]).size).toBe(0);
  });
  it('sizes the guess distribution from the preset limit, extending Unlimited to the longest solve', () => {
    const summary = (group: string, guesses: number[]) => summarizeHistory(guesses.map((count, index) => make(index + 1, { group, guesses: count })))
      .get(group)!.distribution;
    const marks = (group: string, guesses: number[]) => {
      const distribution = summary(group, guesses);
      return distribution.by === 'guesses' ? distribution.rows.map(({ mark }) => mark) : [];
    };
    expect(marks('practice', [2])).toEqual(['1', '2', '3', '4', '5', '✗']);
    expect(marks('sprint', [2])).toEqual(['1', '2', '3', '4', '5', '✗']);
    expect(marks('sprint', [2, 8])).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '✗']);
  });
  it('describes one-try presets by solve time: recent trend, fastest, median and a log-normal fit', () => {
    const inOne = (endedAt: number, durationMs: number, changes: Partial<HistoryRecord> = {}) =>
      make(endedAt, { group: 'in-one', guesses: 1, durationMs, ...changes });
    const time = (records: HistoryRecord[]) => {
      const distribution = summarizeHistory(records).get('in-one')!.distribution;
      if (distribution.by !== 'time') throw new Error('expected a time distribution');
      return distribution;
    };
    const summary = time([
      inOne(1, 20_000), inOne(2, 80_000), inOne(3, 5_000, { result: 'failed', reason: 'attempts' }), inOne(4, 40_000), inOne(5, 10_000),
    ]);
    expect(summary.recent).toEqual([
      { durationMs: 20_000, solved: true }, { durationMs: 80_000, solved: true }, { durationMs: 5_000, solved: false },
      { durationMs: 40_000, solved: true }, { durationMs: 10_000, solved: true }]);
    expect(summary.solves).toEqual([20_000, 80_000, 40_000, 10_000]);
    expect(summary.fastestMs).toBe(10_000);
    expect(summary.medianMs).toBe(30_000);
    // ln(10, 20, 40, 80 seconds) is evenly spaced around ln(28.28…).
    expect(Math.exp(summary.fit!.mu)).toBeCloseTo(Math.sqrt(800), 6);
    expect(summary.fit!.sigma).toBeCloseTo(Math.log(2) * Math.sqrt(5 / 4), 6);
    // Two solves are needed for a fit; identical times still get a drawable width.
    expect(time([inOne(1, 30_000)]).fit).toBeNull();
    expect(time([inOne(1, 30_000), inOne(2, 30_000)]).fit!.sigma).toBe(0.1);
    expect(time([inOne(1, 5_000, { result: 'failed', reason: 'attempts' })])).toMatchObject({ solves: [], fastestMs: null, medianMs: null, fit: null });
    // The trend keeps the latest twenty words.
    const many = time(Array.from({ length: 25 }, (_, index) => inOne(index + 1, (index + 1) * 1000)));
    expect(many.recent).toHaveLength(20);
    expect(many.recent[0].durationMs).toBe(6000);
  });
  it('keeps the best streak after a failure resets the current one', () => {
    const results = ['solved', 'solved', 'solved', 'failed', 'solved'] as const;
    const records = results.map((result, index) => make(index + 1, result === 'failed' ? { result, reason: 'attempts' } : {}));
    expect(summarizeHistory(records).get('practice')).toMatchObject({ currentStreak: 1, bestStreak: 3 });
  });
  it('counts completed and expired sequence rounds, not words', () => {
    const sequence = (endedAt: number, roundId: number, length: WordLength, changes: Partial<HistoryRecord> = {}) =>
      make(endedAt, { group: 'sprint', format: 'sequence', roundId, length, answer: data.answers[length][0], ...changes });
    const summary = summarizeHistory([
      sequence(1, 1, 4), sequence(2, 1, 5), sequence(3, 1, 6),
      sequence(4, 2, 4, { result: 'failed', reason: 'attempts' }), sequence(5, 2, 4, { result: 'failed', reason: 'round-time' }),
      sequence(6, 3, 4),
      make(7, { group: 'sequence', length: 6, answer: 'castle' }),
      make(8, { group: 'sequence', format: 'sequence', roundId: 8, result: 'failed', reason: 'round-time' }),
    ]);
    expect(summary.get('sprint')).toMatchObject({ played: 6, rounds: { completed: 1, expired: 1 } });
    expect(summary.get('sequence')).toMatchObject({ played: 2, rounds: { completed: 0, expired: 1 } });
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
    // Words from custom settings and retired presets are dropped too.
    records.push({ ...make(9), group: 'custom' }, { ...make(10), group: 'retired' });
    expect(parseHistory(JSON.stringify({ version: 1, records }))).toEqual([make(1)]);
  });
  it('recovers from missing, corrupt and other-version storage', () => {
    for (const raw of [null, '{', 'true', '[]', '{"version":2,"records":[]}', '{"version":1}']) {
      expect(parseHistory(raw)).toEqual([]);
    }
  });
});
