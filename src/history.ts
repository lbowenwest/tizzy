import type { Round, Rules, WordLength } from './game';
import { getPresetKey, isPresetKey, presetRules } from './presets';

type FailureReason = NonNullable<Round['reason']>;
export type HistoryRecord = {
  id: string;
  roundId: number;
  answer: string;
  length: WordLength;
  format: Rules['format'];
  group: string; // A preset key.
  result: 'solved' | 'failed';
  reason: FailureReason | null;
  guesses: number;
  unknown: number;
  durationMs: number;
  endedAt: number;
};
export type GroupSummary = {
  played: number;
  solved: number;
  guessDistribution: { guesses: number; count: number }[]; // Solved words, every row from 1 to the guess limit.
  currentStreak: number;
  bestStreak: number;
  averageSolveMs: number | null;
  rounds: { completed: number; expired: number } | null; // Sequences only.
};

export const historyLimit = 1000;
const storageKey = 'word-practice-history-v1';
const reasons: readonly FailureReason[] = ['attempts', 'invalid', 'word-time', 'round-time', 'given-up'];

/**
 * A finished word's record; a word keeps one id, so a later round expiry replaces its earlier result.
 * Only preset rounds are recorded, so every group's statistics compare like with like.
 */
export function toRecord(round: Round): HistoryRecord | null {
  const group = getPresetKey(round.rules);
  if (round.status === 'playing' || round.endedAt === null || group === null) return null;
  return {
    id: `${round.startedAt}:${round.answer}`, roundId: round.roundStartedAt, answer: round.answer,
    length: round.length, format: round.rules.format, group,
    result: round.status === 'won' ? 'solved' : 'failed', reason: round.status === 'won' ? null : round.reason ?? null,
    guesses: round.guesses.length, unknown: round.guesses.filter(({ feedback, rejection }) => feedback === null && rejection === undefined).length,
    durationMs: round.endedAt - round.startedAt, endedAt: round.endedAt,
  };
}

const retain = (records: HistoryRecord[]) => records.sort((a, b) => a.endedAt - b.endedAt).slice(-historyLimit);

export function addRecord(records: readonly HistoryRecord[], record: HistoryRecord): HistoryRecord[] {
  return retain([...records.filter(({ id }) => id !== record.id), record]);
}

const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** Drops malformed records, and records from custom settings or retired presets, which have no group to show. */
function parseRecord(value: any): HistoryRecord | null {
  if (!value || typeof value.id !== 'string' || !count(value.roundId) || ![4, 5, 6].includes(value.length)
    || typeof value.answer !== 'string' || !new RegExp(`^[a-z]{${value.length}}$`).test(value.answer)
    || !['single', 'sequence'].includes(value.format) || !isPresetKey(value.group)
    || !(value.result === 'solved' ? value.reason === null : value.result === 'failed' && reasons.includes(value.reason))
    || !count(value.guesses) || !count(value.unknown) || value.unknown > value.guesses
    || !count(value.durationMs) || !count(value.endedAt)) return null;
  const { id, roundId, answer, length, format, group, result, reason, guesses, unknown, durationMs, endedAt } = value;
  return { id, roundId, answer, length, format, group, result, reason, guesses, unknown, durationMs, endedAt };
}

export function parseHistory(raw: string | null): HistoryRecord[] {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value?.version !== 1 || !Array.isArray(value.records)) return [];
    return retain(value.records.map(parseRecord).filter((record: HistoryRecord | null) => record !== null));
  } catch {
    return [];
  }
}

/** Statistics per group, derived from records alone. */
export function summarizeHistory(records: readonly HistoryRecord[]): Map<string, GroupSummary> {
  const groups = new Map<string, HistoryRecord[]>();
  for (const record of [...records].sort((a, b) => a.endedAt - b.endedAt)) {
    const entries = groups.get(record.group);
    if (entries) entries.push(record);
    else groups.set(record.group, [record]);
  }
  return new Map([...groups].map(([group, entries]) => {
    const solved = entries.filter(({ result }) => result === 'solved');
    // Unlimited presets show at least five rows, extended to the longest solve.
    const limit = presetRules(group).maxGuesses ?? Math.max(5, ...solved.map(({ guesses }) => guesses));
    const guessDistribution = Array.from({ length: limit }, (_, index) => ({
      guesses: index + 1, count: solved.filter(({ guesses }) => guesses === index + 1).length,
    }));
    let currentStreak = 0;
    let bestStreak = 0;
    for (const { result } of entries) {
      currentStreak = result === 'solved' ? currentStreak + 1 : 0;
      bestStreak = Math.max(bestStreak, currentStreak);
    }
    // Custom pools single words and sequences; only sequence words form rounds.
    const sequences = entries.filter(({ format }) => format === 'sequence');
    const roundIds = (matches: (record: HistoryRecord) => boolean) => new Set(sequences.filter(matches).map(({ roundId }) => roundId)).size;
    return [group, {
      played: entries.length,
      solved: solved.length,
      guessDistribution,
      currentStreak,
      bestStreak,
      averageSolveMs: solved.length ? solved.reduce((total, { durationMs }) => total + durationMs, 0) / solved.length : null,
      rounds: sequences.length ? {
        completed: roundIds(({ result, length }) => result === 'solved' && length === 6),
        expired: roundIds(({ reason }) => reason === 'round-time'),
      } : null,
    }];
  }));
}

export function loadHistory(): HistoryRecord[] {
  if (typeof window === 'undefined') return [];
  try { return parseHistory(window.localStorage.getItem(storageKey)); }
  catch { return []; }
}

/** Re-read storage before writing, so another open tab's records survive. */
export function recordResult(round: Round): void {
  const record = toRecord(round);
  if (record === null || typeof window === 'undefined') return;
  try { window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, records: addRecord(loadHistory(), record) })); }
  catch { /* Play remains available when storage is blocked or full. */ }
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(storageKey); }
  catch { /* Nothing stored to clear. */ }
}
