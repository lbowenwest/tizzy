import { useEffect, useState } from 'react';
import { loadWordLists, type WordLists } from './wordLists';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; lists: WordLists }
  | { status: 'error' };

export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    loadWordLists().then(
      (lists) => { if (active) setState({ status: 'loaded', lists }); },
      () => { if (active) setState({ status: 'error' }); },
    );
    return () => { active = false; };
  }, []);

  return (
    <main>
      <h1>Word practice</h1>
      {state.status === 'loading' && <p role="status">Loading word lists…</p>}
      {state.status === 'error' && <p role="alert">Could not load word lists. Reload to try again.</p>}
      {state.status === 'loaded' && (
        <section role="status" aria-label="Loaded word lists">
          <p>Word lists loaded:</p>
          <ul>
            {([4, 5, 6] as const).map((length) => (
              <li key={length}>{length}-letter: {state.lists[length].length.toLocaleString('en-GB')}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
