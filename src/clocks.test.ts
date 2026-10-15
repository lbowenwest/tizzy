import { describe, expect, it } from 'vitest';
import { giveUp, advanceClock, copyRules, defaultRules, nextWord, startRound, submitGuess, type Rules } from './game';
import type { WordData } from './wordLists';
import { presets } from './presets';

const data: WordData = {
  answers: { 4: ['camp', 'coat'], 5: ['chair'], 6: ['castle'] },
  guesses: { 4: ['camp', 'coat'], 5: ['chair', 'cargo'], 6: ['castle', 'candle'] },
};
const allowed = new Set(data.guesses[4]);
const rules = (changes: Partial<Rules> = {}): Rules => ({ ...copyRules(defaultRules), length: 4, ...changes });
const create = (config: Rules) => startRound(data, config, undefined, () => 0, 1000);
const advance = (round: ReturnType<typeof create>, config = round.rules, now = 5000) => nextWord(round, data, config, () => 0, now);

describe('deadline-based clocks', () => {
  it('giving up pauses the round and preserves its exact remaining budget across repeated retries', () => {
    const config = rules({ format: 'sequence', maxGuesses: null, roundSeconds: 90, wordClock: { mode: 'guess', seconds: 10 } });
    const abandoned = giveUp(create(config), 5000);
    expect(abandoned).toMatchObject({ status: 'lost', reason: 'given-up', endedAt: 5000, wordDeadline: 11000, roundDeadline: 91000 });
    expect(advanceClock(abandoned, 200000)).toBe(abandoned);
    const retry = advance(abandoned, rules(), 16000);
    expect(retry).toMatchObject({
      length: 4, status: 'playing', wordDeadline: 26000, roundDeadline: 102000, rules: config,
    });
    const again = giveUp(retry, 17345);
    expect(giveUp(again, 200000)).toBe(again);
    const resumed = advance(again, rules(), 300000);
    expect(resumed.roundDeadline).toBe(384655); // 84.655 seconds, not a fresh ninety
    expect(advanceClock(resumed, 384655)).toMatchObject({ status: 'expired', reason: 'round-time' });
  });
  it.each([[11000, 'lost', 'word-time'], [91000, 'expired', 'round-time']] as const)(
    'giving up at %i respects deadline precedence', (now, status, reason) => {
      const round = create(rules({ format: 'sequence', maxGuesses: null, roundSeconds: 90, wordClock: { mode: 'word', seconds: 10 } }));
      const expired = giveUp(round, now);
      expect(expired).toMatchObject({ status, reason, guesses: [] });
      expect(giveUp(expired, now)).toBe(expired);
    });

  it('keeps the final playing beyond ten accepted and unknown guesses until its deadline', () => {
    const config = presets.find(({ key }) => key === 'final')!.rules;
    let round = create(config);
    for (let index = 0; index < 12; index++) {
      round = submitGuess(round, index % 2 ? 'coat' : 'czzz', allowed, 2000 + index * 1000).round;
      expect(round.status).toBe('playing');
      expect(round.roundDeadline).toBe(91000);
    }
    expect(round.guesses).toHaveLength(12);
    expect(round.guesses.filter(({ feedback }) => feedback === null)).toHaveLength(6);
    expect(advanceClock(round, 90999)).toBe(round);
    const expired = submitGuess(round, 'camp', allowed, 91000).round;
    expect(expired).toMatchObject({ status: 'expired', reason: 'round-time' });
    expect(expired.guesses).toEqual(round.guesses);
  });
  it('retains unlimited guesses and the remaining final budget through every length', () => {
    const config = presets.find(({ key }) => key === 'final')!.rules;
    let round = create(config);
    let now = 1000;
    for (const [length, wrong] of [[4, 'coat'], [5, 'cargo'], [6, 'candle']] as const) {
      const words = new Set(data.guesses[length]);
      for (let index = 0; index < 12; index++) {
        round = submitGuess(round, wrong, words, now += 1000).round;
        expect(round.status).toBe('playing');
      }
      round = submitGuess(round, round.answer, words, now += 1000).round;
      expect(round.status).toBe('won');
      if (length !== 6) {
        const remaining = round.roundDeadline! - now;
        round = advance(round, rules({ maxGuesses: 1 }), now += 1000);
        expect(round.rules.maxGuesses).toBeNull();
        expect(round.roundDeadline! - now).toBe(remaining);
      }
    }
    expect(advanceClock(round, 100000)).toBe(round);
    expect(advance(round, rules({ maxGuesses: 1 }), now + 1000).rules.maxGuesses).toBe(1);
  });
  it('keeps both clocks off by default, even after arbitrarily long idle time', () => {
    const round = create(rules());
    expect(round).toMatchObject({ wordDeadline: null, roundDeadline: null });
    expect(advanceClock(round, 1_000_000)).toBe(round);
  });
  it('sets word/guess deadlines and enables the overall clock only for sequences', () => {
    const config = rules({ wordClock: { mode: 'guess', seconds: 10 }, roundSeconds: 90 });
    expect(create(config)).toMatchObject({ wordDeadline: 11000, roundDeadline: null });
    expect(create({ ...config, format: 'sequence' })).toMatchObject({ wordDeadline: 11000, roundDeadline: 91000 });
  });
  it('keeps a per-word deadline across accepted and rejected guesses', () => {
    const round = create(rules({ wordClock: { mode: 'word', seconds: 10 } }));
    const accepted = submitGuess(round, 'coat', allowed, 5000).round;
    expect(accepted.wordDeadline).toBe(11000);
    const rejected = submitGuess(accepted, 'czzz', allowed, 8000).round;
    expect(rejected).toBe(accepted);
    expect(advanceClock(rejected, 10999)).toBe(rejected);
    expect(advanceClock(rejected, 11000)).toMatchObject({ status: 'lost', reason: 'word-time' });
  });
  it('resets per-guess time on spent attempts, not free rejections or malformed input', () => {
    const round = create(rules({ wordClock: { mode: 'guess', seconds: 10 } }));
    for (const input of ['ca', 'czzz', 'xxxx']) expect(submitGuess(round, input, allowed, 5000).round).toBe(round);
    expect(submitGuess(round, 'coat', allowed, 5000).round.wordDeadline).toBe(15000);
    const consume = create(rules({ invalid: 'consume', wordClock: { mode: 'guess', seconds: 10 } }));
    expect(submitGuess(consume, 'czzz', allowed, 5000).round.wordDeadline).toBe(15000);
  });
  it('fails a word on expiry and refreshes only its deadline for a same-length retry', () => {
    const round = create(rules({ format: 'sequence', wordClock: { mode: 'word', seconds: 10 }, roundSeconds: 90 }));
    const expired = advanceClock(round, 11000);
    const replacement = advance(expired, rules(), 12000);
    expect(replacement).toMatchObject({ length: 4, status: 'playing', wordDeadline: 22000, roundDeadline: 91000 });
    expect(replacement.rules).toEqual(round.rules);
    expect(advanceClock(replacement, 11000)).toBe(replacement); // stale observation from previous word
  });
  it('cannot accept a guess at or after either deadline', () => {
    const word = create(rules({ wordClock: { mode: 'guess', seconds: 10 } }));
    expect(submitGuess(word, 'camp', allowed, 10999).round.status).toBe('won');
    for (const now of [11000, 12000]) expect(submitGuess(word, 'camp', allowed, now).round).toMatchObject({ status: 'lost', reason: 'word-time', guesses: [] });
    const sequence = create(rules({ format: 'sequence', roundSeconds: 10 }));
    expect(submitGuess(sequence, 'camp', allowed, 11000).round).toMatchObject({ status: 'expired', reason: 'round-time', guesses: [] });
  });
  it('gives overall expiry precedence when both deadlines have expired', () => {
    const round = create(rules({ format: 'sequence', wordClock: { mode: 'word', seconds: 10 }, roundSeconds: 10 }));
    expect(advanceClock(round, 11000)).toMatchObject({ status: 'expired', reason: 'round-time' });
  });
  it('does not reset round time on guesses and excludes a solved word\'s result-reading time', () => {
    const round = create(rules({ format: 'sequence', roundSeconds: 90 }));
    const guessed = submitGuess(round, 'coat', allowed, 5000).round;
    expect(guessed.roundDeadline).toBe(91000);
    const solved = submitGuess(guessed, 'camp', allowed, 7000).round;
    const five = advance(solved, rules(), 9000);
    expect(five).toMatchObject({ length: 5, roundDeadline: 93000 });
  });
  it('holds a solved word past its old deadline and resumes its fractional remaining time', () => {
    const round = create(rules({ format: 'sequence', roundSeconds: 10 }));
    const solved = submitGuess(round, 'camp', allowed, 5501).round;
    expect(advanceClock(solved, 90000)).toBe(solved);
    expect(submitGuess(solved, 'camp', allowed, 91000).round).toBe(solved);
    const resumed = advance(solved, rules(), 120000);
    expect(resumed).toMatchObject({ status: 'playing', length: 5, roundDeadline: 125499 });
    expect(advanceClock(resumed, 125498)).toBe(resumed);
    expect(advanceClock(resumed, 125499)).toMatchObject({ status: 'expired', reason: 'round-time' });
  });
  it('still expires an ordinary word failure while its result is displayed', () => {
    const round = create(rules({ format: 'sequence', roundSeconds: 10, invalid: 'fail' }));
    const failed = submitGuess(round, 'czzz', allowed, 5000).round;
    expect(advanceClock(failed, 11000)).toMatchObject({ status: 'expired', reason: 'round-time' });
    const expired = advance(failed, rules(), 11000);
    expect(expired.status).toBe('expired');
    expect(advance(expired, rules(), 12000)).toMatchObject({ status: 'playing', roundDeadline: null });
  });
  it('does not expire a completed final or a terminal single word', () => {
    let round = create(rules({ format: 'sequence', roundSeconds: 90 }));
    for (const length of [4, 5, 6] as const) {
      round = submitGuess(round, round.answer, new Set(data.guesses[length]), 5000).round;
      if (length !== 6) round = advance(round);
    }
    expect(round.endedAt).toBe(5000);
    expect(advanceClock(round, 100000)).toBe(round);
    const single = create(rules({ wordClock: { mode: 'guess', seconds: 10 } }));
    const won = submitGuess(single, 'camp', allowed, 5000).round;
    expect(advanceClock(won, 100000)).toBe(won);
  });
  it('starts new sequence deadlines only when explicitly starting a fresh round', () => {
    const config = rules({ format: 'sequence', roundSeconds: 10 });
    const initial = create(config);
    const expired = advanceClock(initial, 11000);
    const fresh = advance(expired, config, 12000);
    expect(fresh.roundDeadline).toBe(22000);
    expect(advanceClock(fresh, 11000)).toBe(fresh);
  });
  it('stamps each word start and carries the round start through a sequence only', () => {
    const sequence = create(rules({ format: 'sequence' }));
    expect(sequence).toMatchObject({ startedAt: 1000, roundStartedAt: 1000 });
    const solved = submitGuess(sequence, 'camp', allowed, 3000).round;
    expect(advance(solved)).toMatchObject({ startedAt: 5000, roundStartedAt: 1000 });
    const single = submitGuess(create(rules()), 'camp', allowed, 3000).round;
    expect(advance(single, rules())).toMatchObject({ startedAt: 5000, roundStartedAt: 5000 });
  });
  it('deep-copies the clock settings at round start', () => {
    const config = rules({ wordClock: { mode: 'guess', seconds: 10 } });
    const round = create(config);
    config.wordClock.seconds = 99;
    expect(round.rules.wordClock.seconds).toBe(10);
    expect(submitGuess(round, 'coat', allowed, 5000).round.wordDeadline).toBe(15000);
  });
});
