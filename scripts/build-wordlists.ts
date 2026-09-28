import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'vendor/esdb-2026.02.25-60-BZ5.txt');
const expectedHash = '8adc6796c1fc97ceda3d1818904dae5ca5e6bd3c129f24eb7d09ee6655433c0c';
const output = join(root, 'public/words');
const raw = readFileSync(source);

if (createHash('sha256').update(raw).digest('hex') !== expectedHash) {
  throw new Error(`ESDB word list checksum mismatch: ${source}`);
}

const words = new Set(raw.toString('utf8').split(/\r?\n/).filter((word) => /^[a-z]{4,6}$/.test(word)));
const groups = new Map([4, 5, 6].map((length) => [
  length,
  [...words].filter((word) => word.length === length).sort(),
] as const));

if ([...groups.values()].some((group) => group.length === 0)) {
  throw new Error('ESDB produced an empty word length');
}

mkdirSync(output, { recursive: true });
for (const [length, group] of groups) {
  writeFileSync(join(output, `${length}.txt`), `${group.join('\n')}\n`);
}

console.log('Static ESDB guess lists:', Object.fromEntries(
  [...groups].map(([length, group]) => [length, group.length]),
));
