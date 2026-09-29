export type WordLists = { 4: string[]; 5: string[]; 6: string[] };

async function loadList(length: 4 | 5 | 6): Promise<string[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}words/${length}.txt`);
  if (!response.ok) throw new Error(`Word list ${length} could not be fetched`);

  const words = (await response.text()).trim().split(/\r?\n/);
  const pattern = new RegExp(`^[a-z]{${length}}$`);
  if (words.length === 0 || words.some((word) => !pattern.test(word))) {
    throw new Error(`Word list ${length} is invalid`);
  }
  return words;
}

export async function loadWordLists(): Promise<WordLists> {
  const [four, five, six] = await Promise.all([loadList(4), loadList(5), loadList(6)]);
  return { 4: four, 5: five, 6: six };
}
