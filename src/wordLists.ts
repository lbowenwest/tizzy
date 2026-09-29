export type WordLists = { 4: string[]; 5: string[]; 6: string[] };
export type WordData = { guesses: WordLists; answers: WordLists };

const lengths = [4, 5, 6] as const;
type Length = (typeof lengths)[number];

async function loadList(kind: 'guesses' | 'answers', length: Length): Promise<string[]> {
  const path = kind === 'guesses' ? `words/${length}.txt` : `words/answers/${length}.txt`;
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) throw new Error(`Word list ${path} could not be fetched`);

  const pattern = new RegExp(`^[a-z]{${length}}$`);
  const words = (await response.text()).trim().split(/\r?\n/);
  if (words.length === 0 || words.some((word) => !pattern.test(word))) {
    throw new Error(`Word list ${path} is invalid`);
  }
  return words;
}

export async function loadWordData(): Promise<WordData> {
  const lists = await Promise.all(
    (['guesses', 'answers'] as const).map(async (kind) => [
      kind,
      Object.fromEntries(await Promise.all(lengths.map(async (length) => [length, await loadList(kind, length)]))),
    ] as const),
  );
  return { guesses: lists[0][1], answers: lists[1][1] };
}
