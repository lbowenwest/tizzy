import { useEffect, useState } from 'react';
import { loadWordData, type WordData } from './wordLists';

const lengths = [4, 5, 6] as const;

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; data: WordData }
  | { status: 'error' };

export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    loadWordData().then(
      (data) => { if (active) setState({ status: 'loaded', data }); },
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
          <table>
            <thead>
              <tr><th>Letters</th><th>Answers</th><th>Accepted guesses</th></tr>
            </thead>
            <tbody>
              {lengths.map((length) => (
                <tr key={length}>
                  <th scope="row">{length}</th>
                  <td>{state.data.answers[length].length.toLocaleString('en-GB')}</td>
                  <td>{state.data.guesses[length].length.toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
