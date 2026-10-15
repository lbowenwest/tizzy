import type { WordData } from './wordLists';

export type WordLength = 4 | 5 | 6;
export type Rules = {
  format: 'single' | 'sequence';
  length: WordLength;
  invalid: 'reject' | 'consume' | 'fail';
  maxGuesses: number | null; // null means no guess limit.
  wordClock: { mode: 'off' | 'word' | 'guess'; seconds: number };
  roundSeconds: number | null;
};
export const defaultRules: Rules = {
  format: 'single', length: 5, invalid: 'reject', maxGuesses: 5,
  wordClock: { mode: 'off', seconds: 10 }, roundSeconds: null,
};
export function copyRules(rules: Rules): Rules {
  return { ...rules, wordClock: { ...rules.wordClock } };
}
/** Reset fields the format or clock ignores, so rules that play alike compare alike. */
export function normalizeRules(rules: Rules): Rules {
  const sequence = rules.format === 'sequence';
  return {
    ...rules,
    length: sequence ? defaultRules.length : rules.length,
    wordClock: rules.wordClock.mode === 'off' ? { ...defaultRules.wordClock } : { ...rules.wordClock },
    roundSeconds: sequence ? rules.roundSeconds : null,
  };
}
export type LetterFeedback = 'correct' | 'present' | 'absent';
export type Guess = { word: string; feedback: LetterFeedback[] | null };
export type Round = {
  answer: string;
  length: WordLength;
  rules: Rules;
  guesses: Guess[];
  status: 'playing' | 'won' | 'lost' | 'expired';
  reason?: 'attempts' | 'invalid' | 'word-time' | 'round-time' | 'given-up';
  wordDeadline: number | null;
  roundDeadline: number | null;
  startedAt: number;
  roundStartedAt: number;
  endedAt: number | null;
};
export const guessOptions: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Unmatched answer letters a–z; reused because building clues evaluates millions of pairs.
const remaining = new Int8Array(26);
/** Exact matches consume letters first; misplaced matches can only use what's left. Words are lowercase a–z. */
export function evaluateGuess(answer: string, word: string): LetterFeedback[] {
  const feedback: LetterFeedback[] = [];
  remaining.fill(0);
  for (let index = 0; index < answer.length; index++) {
    const letter = answer.charCodeAt(index) - 97;
    if (word.charCodeAt(index) - 97 === letter) feedback.push('correct');
    else { feedback.push('absent'); remaining[letter]++; }
  }
  for (let index = 0; index < word.length; index++) {
    const letter = word.charCodeAt(index) - 97;
    if (feedback[index] !== 'correct' && remaining[letter] > 0) {
      feedback[index] = 'present';
      remaining[letter]--;
    }
  }
  return feedback;
}

/** Keep the strongest evidence for each letter; excess duplicates cannot downgrade it. */
export function keyboardFeedback(guesses: readonly Guess[]): Map<string, LetterFeedback> {
  const knowledge = new Map<string, LetterFeedback>();
  const priority = { absent: 0, present: 1, correct: 2 };
  for (const guess of guesses) {
    if (guess.feedback === null) continue;
    guess.feedback.forEach((feedback, index) => {
      const letter = guess.word[index];
      const previous = knowledge.get(letter);
      if (previous === undefined || priority[feedback] > priority[previous]) knowledge.set(letter, feedback);
    });
  }
  return knowledge;
}

type Evaluation = { valid: true; word: string; feedback: LetterFeedback[] }
  | { valid: false; reason: 'shape' | 'first-letter'; message: string }
  | { valid: false; reason: 'unknown'; word: string; message: string };

export function evaluateCandidate(answer: string, input: string, allowed: ReadonlySet<string>): Evaluation {
  const word = input.toLowerCase();
  if (!new RegExp(`^[a-z]{${answer.length}}$`).test(word)) {
    return { valid: false, reason: 'shape', message: `Enter all ${answer.length} letters before checking.` };
  }
  if (word[0] !== answer[0]) return { valid: false, reason: 'first-letter', message: `Start with ${answer[0].toUpperCase()}.` };
  if (!allowed.has(word)) return { valid: false, reason: 'unknown', word, message: 'Not in the word list. Try another word; no guess used.' };
  return { valid: true, word, feedback: evaluateGuess(answer, word) };
}

function newWord(data: WordData, rules: Rules, length: WordLength, now: number,
  roundDeadline: number | null, roundStartedAt: number, previous?: string, random = Math.random): Round {
  const pool = data.answers[length];
  const alternatives = pool.filter((answer) => answer !== previous);
  const candidates = alternatives.length ? alternatives : pool;
  if (!candidates.length) throw new Error('No answers available');
  const answer = candidates[Math.floor(random() * candidates.length)];
  return {
    answer, length, rules: copyRules(rules), guesses: [], status: 'playing',
    wordDeadline: rules.wordClock.mode === 'off' ? null : now + rules.wordClock.seconds * 1000,
    roundDeadline, startedAt: now, roundStartedAt, endedAt: null,
  };
}

export function startRound(data: WordData, rules: Rules, previous?: string, random = Math.random, now = Date.now()): Round {
  const roundDeadline = rules.format === 'sequence' && rules.roundSeconds !== null ? now + rules.roundSeconds * 1000 : null;
  return newWord(data, rules, rules.format === 'sequence' ? 4 : rules.length, now, roundDeadline, now, previous, random);
}

export function isSequenceComplete(round: Round): boolean {
  return round.rules.format === 'sequence' && round.length === 6 && round.status === 'won';
}

export function isRoundClockPaused(round: Round): boolean {
  return round.status === 'won' || round.reason === 'given-up';
}

/** Tick against current deadlines, never a captured puzzle or a count of interval callbacks. */
export function advanceClock(round: Round, now = Date.now()): Round {
  if (round.status === 'expired' || isRoundClockPaused(round)) return round;
  // Ordinary failure results still use wall time; solves and give-ups pause it.
  if (round.roundDeadline !== null && now >= round.roundDeadline) {
    return { ...round, status: 'expired', reason: 'round-time', endedAt: now };
  }
  if (round.status === 'playing' && round.wordDeadline !== null && now >= round.wordDeadline) {
    return { ...round, status: 'lost', reason: 'word-time', endedAt: now };
  }
  return round;
}

export function giveUp(round: Round, now = Date.now()): Round {
  const checked = advanceClock(round, now);
  if (checked !== round || round.status !== 'playing' || round.rules.maxGuesses !== null) return checked;
  return { ...round, status: 'lost', reason: 'given-up', endedAt: now };
}

export function nextWord(round: Round, data: WordData, nextRules: Rules, random = Math.random, now = Date.now()): Round {
  const checked = advanceClock(round, now);
  // If time expired between rendering and clicking, show the expiry before starting anew.
  if (checked !== round) return checked;
  if (round.status === 'playing') return round;
  if (round.rules.format === 'sequence' && !isSequenceComplete(round) && round.status !== 'expired') {
    const length = round.status === 'won' ? (round.length + 1) as WordLength : round.length;
    const roundDeadline = round.roundDeadline !== null && isRoundClockPaused(round)
      ? now + Math.max(0, round.roundDeadline - round.endedAt!) : round.roundDeadline;
    return newWord(data, round.rules, length, now, roundDeadline, round.roundStartedAt, round.answer, random);
  }
  return startRound(data, nextRules, round.answer, random, now);
}

export function submitGuess(round: Round, input: string, allowed: ReadonlySet<string>, now = Date.now()): { round: Round; message: string } {
  const checked = advanceClock(round, now);
  if (checked !== round || round.status !== 'playing') return { round: checked, message: '' };
  const evaluation = evaluateCandidate(round.answer, input, allowed);
  let guess: Guess;
  if (!evaluation.valid) {
    if (evaluation.reason !== 'unknown' || round.rules.invalid === 'reject') return { round, message: evaluation.message };
    if (round.rules.invalid === 'fail') {
      return { round: { ...round, status: 'lost', reason: 'invalid', endedAt: now }, message: 'That word is not in the list, so this word has ended.' };
    }
    guess = { word: evaluation.word, feedback: null };
  } else {
    guess = { word: evaluation.word, feedback: evaluation.feedback };
  }
  const guesses = [...round.guesses, guess];
  const status = evaluation.valid && evaluation.word === round.answer ? 'won'
    : round.rules.maxGuesses !== null && guesses.length >= round.rules.maxGuesses ? 'lost' : 'playing';
  return {
    round: {
      ...round, guesses, status, ...(status === 'lost' ? { reason: 'attempts' as const } : {}),
      endedAt: status === 'playing' ? null : now,
      // Spending an unknown-word attempt starts the next guess's window too.
      wordDeadline: status === 'playing' && round.rules.wordClock.mode === 'guess'
        ? now + round.rules.wordClock.seconds * 1000 : round.wordDeadline,
    },
    message: !evaluation.valid ? round.rules.maxGuesses === null
      ? 'Not in the word list. No letter clues awarded.' : 'Not in the word list. Guess used; no letter clues awarded.'
      : status === 'playing' ? 'Guess checked. Follow the letter clues.' : '',
  };
}
