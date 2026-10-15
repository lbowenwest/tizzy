export type WordLists = { 4: string[]; 5: string[]; 6: string[] };
/** An answer with up to three clue words that only it fits; see docs/wordlist.md. */
export type Clue = { answer: string; clues: string[] };
export type WordData = { guesses: WordLists; answers: WordLists; clues: { 4: Clue[]; 5: Clue[]; 6: Clue[] } };

const lengths = [4, 5, 6] as const;
type Length = (typeof lengths)[number];

async function loadLines(path: string, line: RegExp): Promise<string[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) throw new Error(`Word list ${path} could not be fetched`);
  const lines = (await response.text()).trim().split(/\r?\n/);
  if (lines.some((text) => !line.test(text))) throw new Error(`Word list ${path} is invalid`);
  return lines;
}

function loadList(kind: 'guesses' | 'answers', length: Length): Promise<string[]> {
  return loadLines(kind === 'guesses' ? `words/${length}.txt` : `words/answers/${length}.txt`, new RegExp(`^[a-z]{${length}}$`));
}

async function loadClues(length: Length): Promise<Clue[]> {
  const lines = await loadLines(`words/clues/${length}.txt`, new RegExp(`^[a-z]{${length}}( [a-z]{${length}}){1,3}$`));
  return lines.map((text) => {
    const [answer, ...clues] = text.split(' ');
    return { answer, clues };
  });
}

export async function loadWordData(): Promise<WordData> {
  const byLength = <T>(load: (length: Length) => Promise<T>) =>
    Promise.all(lengths.map(async (length) => [length, await load(length)] as const)).then(Object.fromEntries);
  const [guesses, answers, clues] = await Promise.all([
    byLength((length) => loadList('guesses', length)),
    byLength((length) => loadList('answers', length)),
    byLength(loadClues),
  ]);
  return { guesses, answers, clues };
}
