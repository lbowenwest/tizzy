import pools from './daily-v1.json';
import { defaultRules, startWord, submitGuess, type Round } from './game';

export type DailyVariant = 'given' | 'hidden';
export type DailyRun = { date: string; variant: DailyVariant; stages: Round[] };
export const dailyStorageKey = 'tizzy-daily-v1';
const dayMs = 86_400_000;
const epoch = Date.UTC(2026, 9, 16);
export const dailyDate = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const variantLabel = (variant: DailyVariant) => variant === 'given' ? 'First letter given' : 'No first letter';

/** Immutable v1 pools: dictionary rebuilds must never move an existing daily puzzle. */
export function dailyWords(date: string, variant: DailyVariant): string[] {
  const day = Math.floor((Date.parse(date + 'T00:00:00Z') - epoch) / dayMs);
  return ([4, 5, 6] as const).map((length) => {
    const pool = pools[length];
    const index = day * 2 + (variant === 'hidden' ? 1 : 0);
    return pool[((index % pool.length) + pool.length) % pool.length];
  });
}
function word(run: Pick<DailyRun, 'date' | 'variant'>, stage: number, now: number): Round {
  return startWord(dailyWords(run.date, run.variant)[stage], {
    ...defaultRules, format: 'sequence', firstLetter: run.variant === 'given', maxGuesses: null,
  }, now);
}
export function startDaily(date: string, variant: DailyVariant, now = Date.now()): DailyRun {
  return { date, variant, stages: [word({ date, variant }, 0, now)] };
}
export const dailyComplete = (run: DailyRun) => run.stages.length === 3 && run.stages[2].status === 'won';
export function continueDaily(run: DailyRun, now = Date.now()): DailyRun {
  if (dailyComplete(run) || run.stages.at(-1)!.status !== 'won') return run;
  return { ...run, stages: [...run.stages, word(run, run.stages.length, now)] };
}
export const wordElapsed = (round: Round, now = Date.now()) => Math.max(0, (round.endedAt ?? now) - round.startedAt);
export const dailyElapsed = (run: DailyRun, now = Date.now()) => run.stages.reduce((sum, round) => sum + wordElapsed(round, now), 0);
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function shareDaily(run: DailyRun): string {
  return [`Tizzy Daily Climb · ${run.date}`, variantLabel(run.variant),
    ...run.stages.map((stage) => `${stage.length} letters: ${formatElapsed(wordElapsed(stage))} · ${stage.guesses.length} ${stage.guesses.length === 1 ? 'guess' : 'guesses'}`),
    `Total: ${formatElapsed(dailyElapsed(run))}`].join('\n');
}

/** Rebuild saved play through the game rules; never trust saved answers, feedback or status. */
function restore(value: unknown): DailyRun | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const { date, variant, stages } = value as DailyRun;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || dailyDate(Date.parse(date + 'T00:00:00Z')) !== date || (variant !== 'given' && variant !== 'hidden')
      || !Array.isArray(stages) || stages.length < 1 || stages.length > 3) return null;
    const restored: Round[] = [];
    for (const [index, saved] of stages.entries()) {
      if (!Number.isSafeInteger(saved.startedAt) || saved.startedAt < Date.parse(date + 'T00:00:00Z')
        || (index > 0 && (restored[index - 1].status !== 'won' || saved.startedAt < restored[index - 1].endedAt!))
        || !Array.isArray(saved.guesses)) return null;
      let round = word({ date, variant }, index, saved.startedAt);
      const endedAt = saved.endedAt;
      if (endedAt !== null && (!Number.isSafeInteger(endedAt) || endedAt < saved.startedAt)) return null;
      for (const guess of saved.guesses) {
        if (round.status !== 'playing' || typeof guess.word !== 'string'
          || !new RegExp(`^[a-z]{${round.length}}$`).test(guess.word)) return null;
        const result = submitGuess(round, guess.word, new Set([guess.word]), endedAt ?? saved.startedAt).round;
        if (result === round) return null;
        round = result;
      }
      if ((round.status === 'won') !== (endedAt !== null)) return null;
      restored.push(round);
    }
    return { date, variant, stages: restored };
  } catch { return null; }
}
export function parseDaily(raw: string | null): DailyRun[] {
  try {
    const values: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(values)) return [];
    const unique = new Map<string, DailyRun>();
    for (const value of values) {
      const run = restore(value);
      if (run) unique.set(`${run.date}/${run.variant}`, run);
    }
    return [...unique.values()];
  } catch { return []; }
}
export function loadDaily(): DailyRun[] {
  try { return parseDaily(localStorage.getItem(dailyStorageKey)); }
  catch { return []; }
}

/** A stale tab may only extend the saved guess history, never restart or overwrite a different path. */
function extendsRun(next: DailyRun, prior: DailyRun): boolean {
  return next.stages.length >= prior.stages.length && prior.stages.every((stage, index) => {
    const candidate = next.stages[index];
    return candidate.startedAt === stage.startedAt && candidate.guesses.length >= stage.guesses.length
      && (stage.endedAt === null || stage.endedAt === candidate.endedAt)
      && stage.guesses.every((guess, turn) => candidate.guesses[turn].word === guess.word);
  });
}
export function saveDaily(run: DailyRun): { run: DailyRun; saved: boolean } {
  try {
    const all = loadDaily();
    const prior = all.find((item) => item.date === run.date && item.variant === run.variant);
    const chosen = prior && !extendsRun(run, prior) ? prior : run;
    const others = all.filter((item) => item.date !== run.date || item.variant !== run.variant);
    const records = [...others, chosen].sort((a, b) => a.date.localeCompare(b.date)).slice(-1000);
    localStorage.setItem(dailyStorageKey, JSON.stringify(records));
    return { run: chosen, saved: true };
  } catch { return { run, saved: false }; }
}

export function dailyStats(runs: DailyRun[], variant: DailyVariant, today = dailyDate()) {
  const completed = runs.filter((run) => run.variant === variant && dailyComplete(run));
  const times = completed.map((run) => dailyElapsed(run));
  const dates = new Set(completed.map((run) => run.date));
  let cursor = Date.parse(today + 'T00:00:00Z');
  if (!dates.has(today)) cursor -= dayMs;
  let streak = 0;
  while (dates.has(dailyDate(cursor))) { streak++; cursor -= dayMs; }
  return { completed: completed.length, streak, best: times.length ? Math.min(...times) : null,
    average: times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : null };
}
