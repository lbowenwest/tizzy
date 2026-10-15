import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateGuess } from '../src/game';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lengths = [4, 5, 6] as const;
type Length = (typeof lengths)[number];

/** Answers use only the most common size tier, so puzzle answers stay familiar. */
const answerSizeCeiling = 35;

const guessSource = {
  path: join(root, 'vendor/esdb-2026.02.25-60-BZ5.txt'),
  hash: '8adc6796c1fc97ceda3d1818904dae5ca5e6bd3c129f24eb7d09ee6655433c0c',
};
const tierSource = {
  path: join(root, 'vendor/esdb-2026.02.25-sizes.txt'),
  hash: 'd5dd185fe19c6ae66d21f37d039d74fb6983c347c0086962c7b4c21bdbc16860',
};
// Upstream word-form tags distinguish plural nouns from verbs and other senses.
const pluralSource = {
  path: join(root, 'vendor/esdb-2026.02.25-plural-nouns.txt'),
  hash: '612b7950b8d8954fd7ccf43976a23ed49dd0b1f1054c2e77d37c5220557d741f',
};

function readPinned({ path, hash }: { path: string; hash: string }): string {
  const raw = readFileSync(path);
  if (createHash('sha256').update(raw).digest('hex') !== hash) {
    throw new Error(`ESDB source checksum mismatch: ${path}`);
  }
  return raw.toString('utf8');
}

const guessWords = new Set(
  readPinned(guessSource)
    .split(/\r?\n/)
    .filter((word) => /^[a-z]{4,6}$/.test(word)),
);

const commonWords = new Set(
  readPinned(tierSource)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split('\t'))
    .filter(([, size]) => Number(size) <= answerSizeCeiling)
    .map(([word]) => word),
);

const pluralNouns = new Set(readPinned(pluralSource).split(/\r?\n/).filter(Boolean));

const excluded = new Set(
  readFileSync(join(root, 'data/excluded-answers.txt'), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean),
);

const byLength = (length: Length, words: Set<string>) =>
  [...words].filter((word) => word.length === length).sort();

const guesses = new Map(lengths.map((length) => [length, byLength(length, guessWords)] as const));
const answers = new Map(
  lengths.map((length) => [
    length,
    byLength(length, new Set([...commonWords].filter((word) => guessWords.has(word) && !excluded.has(word) && !pluralNouns.has(word)))),
  ] as const),
);

for (const length of lengths) {
  if (answers.get(length)!.length === 0) throw new Error(`No ${length}-letter answers were curated`);
}

const feedbackKey = (answer: string, word: string) =>
  evaluateGuess(answer, word).reduce((key, mark) => key * 3 + (mark === 'correct' ? 2 : mark === 'present' ? 1 : 0), 0);

/**
 * A clue is a familiar word whose feedback against the answer no other accepted guess shares,
 * so only the answer fits it. At most half its letters may be right-place, to avoid giveaways.
 * Each answer keeps its hardest, middle and easiest qualifying clues.
 */
function buildClues(length: Length): string[] {
  const accepted = guesses.get(length)!;
  const familiar = new Set(answers.get(length)!);
  const maxCorrect = Math.floor(length / 2);
  const found = new Map<string, { clue: string; correct: number; shown: number }[]>();
  for (const clue of familiar) {
    const buckets = new Map<number, { count: number; word: string }>();
    for (const word of accepted) {
      const key = feedbackKey(word, clue);
      const bucket = buckets.get(key);
      if (bucket) bucket.count++; else buckets.set(key, { count: 1, word });
    }
    for (const { count, word } of buckets.values()) {
      if (count !== 1 || word === clue || !familiar.has(word)) continue;
      const feedback = evaluateGuess(word, clue);
      const correct = feedback.filter((mark) => mark === 'correct').length;
      if (correct > maxCorrect) continue;
      const shown = feedback.filter((mark) => mark !== 'absent').length;
      const options = found.get(word) ?? [];
      options.push({ clue, correct, shown });
      found.set(word, options);
    }
  }
  return [...found].sort(([a], [b]) => (a < b ? -1 : 1)).map(([answer, options]) => {
    options.sort((a, b) => a.correct - b.correct || a.shown - b.shown || (a.clue < b.clue ? -1 : 1));
    const picks = [options[0], options[Math.floor((options.length - 1) / 2)], options[options.length - 1]];
    return [answer, ...new Set(picks.map(({ clue }) => clue))].join(' ');
  });
}
const clues = new Map(lengths.map((length) => [length, buildClues(length)] as const));

mkdirSync(join(root, 'public/words/answers'), { recursive: true });
mkdirSync(join(root, 'public/words/clues'), { recursive: true });
for (const length of lengths) {
  writeFileSync(join(root, `public/words/${length}.txt`), `${guesses.get(length)!.join('\n')}\n`);
  writeFileSync(join(root, `public/words/answers/${length}.txt`), `${answers.get(length)!.join('\n')}\n`);
  writeFileSync(join(root, `public/words/clues/${length}.txt`), `${clues.get(length)!.join('\n')}\n`);
}

console.log('Static ESDB lists:', Object.fromEntries(
  lengths.flatMap((length) => [
    [`guesses/${length}`, guesses.get(length)!.length], [`answers/${length}`, answers.get(length)!.length],
    [`clues/${length}`, clues.get(length)!.length],
  ]),
));
