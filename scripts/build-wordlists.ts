import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    byLength(length, new Set([...commonWords].filter((word) => guessWords.has(word) && !excluded.has(word)))),
  ] as const),
);

for (const length of lengths) {
  if (answers.get(length)!.length === 0) throw new Error(`No ${length}-letter answers were curated`);
}

mkdirSync(join(root, 'public/words/answers'), { recursive: true });
for (const length of lengths) {
  writeFileSync(join(root, `public/words/${length}.txt`), `${guesses.get(length)!.join('\n')}\n`);
  writeFileSync(join(root, `public/words/answers/${length}.txt`), `${answers.get(length)!.join('\n')}\n`);
}

console.log('Static ESDB lists:', Object.fromEntries(
  lengths.flatMap((length) => [[`guesses/${length}`, guesses.get(length)!.length], [`answers/${length}`, answers.get(length)!.length]]),
));
