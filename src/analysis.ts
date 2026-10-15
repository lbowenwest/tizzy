import { evaluateGuess, explainContradiction, type Round } from './game';
import type { WordData } from './wordLists';

export type GuessValue = { word: string; bits: number; expectedRemaining: number; solveChance: number };
export type GuessAnalysis = {
  word: string;
  before: number;
  after: number;
  remaining: string[];
  value: GuessValue | null;
  bestBits: number;
  alternatives: GuessValue[];
  lastTry: boolean;
};
export type WordAnalysis = { kind: 'information'; guesses: GuessAnalysis[] }
  | { kind: 'clue'; word: string; answer: string; explanations: { word: string; reason: string }[] };

/** Every remaining curated answer has equal weight. The actual answer is never an input. */
function valueOf(word: string, candidates: readonly string[]): GuessValue {
  const buckets = new Map<string, number>();
  for (const answer of candidates) {
    const pattern = evaluateGuess(answer, word).join();
    buckets.set(pattern, (buckets.get(pattern) ?? 0) + 1);
  }
  let bits = 0;
  let expectedRemaining = 0;
  for (const count of buckets.values()) {
    const probability = count / candidates.length;
    bits -= probability * Math.log2(probability);
    expectedRemaining += probability * count;
  }
  return { word, bits, expectedRemaining, solveChance: candidates.includes(word) ? 1 / candidates.length : 0 };
}

/** Replay only evidence available before each guess; compare all legal guesses, including probes. */
export function analyseFinishedWord(round: Round, data: WordData): WordAnalysis | null {
  if (round.status === 'playing') return null;
  if (round.clue) {
    const clue = round.clue;
    return {
      kind: 'clue', word: clue.word, answer: round.answer,
      explanations: round.guesses.map(({ word, feedback }) => ({
        word, reason: explainContradiction(clue, word)
          ?? (feedback ? 'Fits every mark in the clue.' : 'Not in the word list; no letter clues awarded.'),
      })),
    };
  }
  const first = round.answer[0]; // Publicly supplied hint, not hidden answer knowledge.
  const legal = data.guesses[round.length].filter((word) => word[0] === first);
  let candidates = data.answers[round.length].filter((word) => word[0] === first);
  const guesses = round.guesses.map(({ word, feedback }, index): GuessAnalysis => {
    const before = candidates.length;
    const lastTry = round.rules.maxGuesses !== null && index + 1 === round.rules.maxGuesses;
    if (feedback === null) return { word, before, after: before, remaining: candidates, value: null, bestBits: 0, alternatives: [], lastTry };
    const value = valueOf(word, candidates);
    const ranked = legal.map((candidate) => valueOf(candidate, candidates))
      .sort((a, b) => b.bits - a.bits || b.solveChance - a.solveChance || a.word.localeCompare(b.word));
    const bestBits = ranked[0]?.bits ?? 0;
    const alternatives = ranked.filter((candidate) => candidate.word !== word && candidate.bits > value.bits + 1e-9).slice(0, 3);
    const pattern = feedback.join();
    candidates = candidates.filter((answer) => evaluateGuess(answer, word).join() === pattern);
    return { word, before, after: candidates.length, remaining: candidates, value, bestBits, alternatives, lastTry };
  });
  return { kind: 'information', guesses };
}
