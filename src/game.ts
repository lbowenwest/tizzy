import type { WordData } from './wordLists';

export type WordLength = 4 | 5 | 6;
export type Rules = { format: 'single' | 'sequence'; length: WordLength; invalid: 'reject' | 'fail' };
export type LetterFeedback = 'correct' | 'present' | 'absent';
export type Guess = { word: string; feedback: LetterFeedback[] };
export type Round = {
  answer: string;
  length: WordLength;
  rules: Rules;
  guesses: Guess[];
  status: 'playing' | 'won' | 'lost';
  reason?: 'attempts' | 'invalid';
};
export const attempts = 5;

/** Exact matches consume letters first; misplaced matches can only use what's left. */
export function evaluateGuess(answer: string, word: string): LetterFeedback[] {
  const feedback: LetterFeedback[] = Array(word.length).fill('absent');
  const remaining = new Map<string, number>();
  for (let index = 0; index < answer.length; index++) {
    if (word[index] === answer[index]) feedback[index] = 'correct';
    else remaining.set(answer[index], (remaining.get(answer[index]) ?? 0) + 1);
  }
  for (let index = 0; index < word.length; index++) {
    if (feedback[index] === 'correct') continue;
    const available = remaining.get(word[index]) ?? 0;
    if (available > 0) {
      feedback[index] = 'present';
      remaining.set(word[index], available - 1);
    }
  }
  return feedback;
}

/** A gray duplicate tile does not rule out a letter with any positive match. */
export function unavailableLetters(guesses: readonly Guess[]): Set<string> {
  const absent = new Set<string>();
  const matched = new Set<string>();
  for (const guess of guesses) {
    for (let index = 0; index < guess.word.length; index++) {
      (guess.feedback[index] === 'absent' ? absent : matched).add(guess.word[index]);
    }
  }
  return new Set([...absent].filter((letter) => !matched.has(letter)));
}

type Evaluation = { valid: true; word: string; feedback: LetterFeedback[] }
  | { valid: false; reason: 'shape' | 'first-letter' | 'unknown'; message: string };

export function evaluateCandidate(answer: string, input: string, allowed: ReadonlySet<string>): Evaluation {
  const word = input.toLowerCase();
  if (!new RegExp(`^[a-z]{${answer.length}}$`).test(word)) {
    return { valid: false, reason: 'shape', message: `Enter all ${answer.length} letters before checking.` };
  }
  if (word[0] !== answer[0]) return { valid: false, reason: 'first-letter', message: `Start with ${answer[0].toUpperCase()}.` };
  if (!allowed.has(word)) return { valid: false, reason: 'unknown', message: 'Not in the word list. Try another word; no guess used.' };
  return { valid: true, word, feedback: evaluateGuess(answer, word) };
}

function newWord(data: WordData, rules: Rules, length: WordLength, previous?: string, random = Math.random): Round {
  const pool = data.answers[length];
  const alternatives = pool.filter((answer) => answer !== previous);
  const candidates = alternatives.length ? alternatives : pool;
  if (!candidates.length) throw new Error('No answers available');
  const answer = candidates[Math.floor(random() * candidates.length)];
  return { answer, length, rules: { ...rules }, guesses: [], status: 'playing' };
}

export function startRound(data: WordData, rules: Rules, previous?: string, random = Math.random): Round {
  return newWord(data, rules, rules.format === 'sequence' ? 4 : rules.length, previous, random);
}

export function isSequenceComplete(round: Round): boolean {
  return round.rules.format === 'sequence' && round.length === 6 && round.status === 'won';
}

export function nextWord(round: Round, data: WordData, nextRules: Rules, random = Math.random): Round {
  if (round.status === 'playing') return round;
  if (round.rules.format === 'sequence' && !isSequenceComplete(round)) {
    const length = round.status === 'won' ? (round.length + 1) as WordLength : round.length;
    return newWord(data, round.rules, length, round.answer, random);
  }
  return startRound(data, nextRules, round.answer, random);
}

export function submitGuess(round: Round, input: string, allowed: ReadonlySet<string>): { round: Round; message: string } {
  if (round.status !== 'playing') return { round, message: '' };
  const evaluation = evaluateCandidate(round.answer, input, allowed);
  if (!evaluation.valid) {
    if (evaluation.reason !== 'unknown' || round.rules.invalid === 'reject') return { round, message: evaluation.message };
    return { round: { ...round, status: 'lost', reason: 'invalid' }, message: 'That word is not in the list, so this word has ended.' };
  }
  const guesses = [...round.guesses, { word: evaluation.word, feedback: evaluation.feedback }];
  const status = evaluation.word === round.answer ? 'won' : guesses.length === attempts ? 'lost' : 'playing';
  return {
    round: { ...round, guesses, status, ...(status === 'lost' ? { reason: 'attempts' as const } : {}) },
    message: status === 'playing' ? 'Guess checked. Follow the letter clues.' : '',
  };
}
