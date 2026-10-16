import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { continueDaily, dailyComplete, dailyDate, dailyElapsed, dailyStats, dailyWords, formatElapsed,
  loadDaily, parseDaily, saveDaily, shareDaily, startDaily, wordElapsed, type DailyRun } from './daily';
import { submitGuess } from './game';
import { getPresetKey } from './presets';
import pools from './daily-v1.json';

const date = '2026-10-16';
const start = Date.parse(date + 'T10:00:00Z');
function solve(run: DailyRun, now: number): DailyRun {
  const round = run.stages.at(-1)!;
  return { ...run, stages: [...run.stages.slice(0, -1), submitGuess(round, round.answer, new Set([round.answer]), now).round] };
}
function completed(date: string, variant: 'given' | 'hidden' = 'given'): DailyRun {
  const time = Date.parse(date + 'T10:00:00Z');
  let run = startDaily(date, variant, time);
  for (let index = 0; index < 3; index++) {
    run = solve(run, time + index * 10000 + 2000);
    run = continueDaily(run, time + (index + 1) * 10000);
  }
  return run;
}
afterEach(() => vi.unstubAllGlobals());

describe('daily courses', () => {
  it('pins both courses independently of randomness and subsequent word-list ordering', () => {
    const given = dailyWords(date, 'given');
    expect(given).toEqual(['flat', 'jeans', 'tutors']);
    expect(dailyWords(date, 'hidden')).toEqual(['oust', 'corns', 'splint']);
    expect(given).toEqual([pools[4][0], pools[5][0], pools[6][0]]);
    expect(dailyWords(date, 'hidden')).toEqual([pools[4][1], pools[5][1], pools[6][1]]);
    expect(dailyWords('2026-10-17', 'given')).toEqual([pools[4][2], pools[5][2], pools[6][2]]);
    expect(dailyWords(date, 'given')).toEqual(given);
    for (const length of [4, 5, 6] as const) {
      const accepted = new Set(readFileSync(`public/words/${length}.txt`, 'utf8').trim().split('\n'));
      const answers = new Set(readFileSync(`public/words/answers/${length}.txt`, 'utf8').trim().split('\n'));
      expect(pools[length].every((word) => accepted.has(word) && answers.has(word))).toBe(true);
      expect(new Set(pools[length]).size).toBe(pools[length].length);
    }
  });
  it('uses the same date worldwide and changes at midnight UTC', () => {
    expect(dailyDate(Date.parse('2026-10-16T23:59:59.999Z'))).toBe(date);
    expect(dailyDate(Date.parse('2026-10-17T00:00:00Z'))).toBe('2026-10-17');
  });
  it('allows more than five guesses and keeps daily results out of practice history', () => {
    let run = startDaily(date, 'hidden', start);
    let round = run.stages[0];
    const wrong = ['care', 'bale'].find((word) => word !== round.answer)!;
    for (let index = 0; index < 8; index++) round = submitGuess(round, wrong, new Set([wrong]), start + index * 1000).round;
    expect(round.status).toBe('playing');
    expect(round.guesses).toHaveLength(8);
    expect(round.wordDeadline).toBeNull();
    expect(round.roundDeadline).toBeNull();
    expect(getPresetKey(round.rules)).toBeNull();
    run = solve({ ...run, stages: [round] }, start + 9000);
    expect(run.stages[0].status).toBe('won');
    expect(continueDaily(startDaily(date, 'given', start), start + 100)).toEqual(startDaily(date, 'given', start));
  });
  it('sums word splits, excludes breaks, keeps open-word time on reload and cannot restart a finish', () => {
    let run = startDaily(date, 'given', start);
    expect(dailyElapsed(run, start + 12000)).toBe(12000);
    run = solve(run, start + 12000);
    expect(dailyElapsed(run, start + 50000)).toBe(12000);
    run = continueDaily(run, start + 50000);
    const restored = parseDaily(JSON.stringify([run]))[0];
    expect(dailyElapsed(restored, start + 65000)).toBe(27000);
    run = solve(restored, start + 65000);
    run = solve(continueDaily(run, start + 100000), start + 123456);
    expect(dailyComplete(run)).toBe(true);
    expect(run.stages.map((stage) => wordElapsed(stage))).toEqual([12000, 15000, 23456]);
    expect(formatElapsed(dailyElapsed(run))).toBe('0:50');
    expect(continueDaily(run, start + 200000)).toBe(run);
    const share = shareDaily(run);
    expect(share).toContain('First letter given');
    expect(share).toContain('Total: 0:50');
    for (const stage of run.stages) expect(share.toLowerCase()).not.toContain(stage.answer);
  });
});

describe('daily storage and records', () => {
  it('recovers from malformed saves and rebuilds answer, feedback and rules from the course', () => {
    for (const raw of [null, '{', '{}', '[null]', '[{"date":"2026-02-30"}]']) expect(parseDaily(raw)).toEqual([]);
    const run = completed(date);
    const saved = structuredClone(run);
    saved.stages[0].answer = 'fake';
    saved.stages[0].rules.firstLetter = false;
    saved.stages[0].guesses[0].feedback = null;
    expect(parseDaily(JSON.stringify([saved]))).toEqual([run]);
    saved.stages[1].startedAt = start - 1;
    expect(parseDaily(JSON.stringify([saved]))).toEqual([]);
    const unfinished = startDaily(date, 'given', start);
    unfinished.stages[0].endedAt = start + 1;
    expect(parseDaily(JSON.stringify([unfinished]))).toEqual([]);
  });
  it('preserves both variants and refuses stale-tab rewinds or conflicting guesses', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
    const initial = startDaily(date, 'given', start);
    const solved = solve(initial, start + 1000);
    expect(saveDaily(initial).saved).toBe(true);
    saveDaily(solved);
    expect(saveDaily(initial).run).toEqual(solved);
    expect(saveDaily(startDaily(date, 'given', start + 2000)).run).toEqual(solved);
    const hidden = startDaily(date, 'hidden', start);
    const round = hidden.stages[0];
    saveDaily({ ...hidden, stages: [submitGuess(round, 'care', new Set(['care']), start + 1000).round] });
    const conflict = { ...hidden, stages: [submitGuess(round, 'bale', new Set(['bale']), start + 1000).round] };
    expect(saveDaily(conflict).run.stages[0].guesses[0].word).toBe('care');
    expect(loadDaily()).toHaveLength(2);
  });
  it('lets the current run continue when storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    const run = startDaily(date, 'given', start);
    expect(loadDaily()).toEqual([]);
    expect(saveDaily(run)).toEqual({ run, saved: false });
  });
  it('separates variant records and counts streaks by puzzle day, with today still available', () => {
    const runs = [completed('2026-10-14'), completed('2026-10-15'), completed(date, 'hidden')];
    expect(dailyStats(runs, 'given', date)).toEqual({ completed: 2, streak: 2, best: 6000, average: 6000 });
    expect(dailyStats(runs, 'hidden', date).streak).toBe(1);
    expect(dailyStats(runs, 'given', '2026-10-17').streak).toBe(0);
  });
});
