import { useEffect, useState } from 'react';
import { loadWordData, type WordData } from './wordLists';
import { Play } from './Play';
import { Dialog } from './Dialog';
import { Settings } from './Settings';
import { loadPreferences, savePreferences, type Preferences } from './preferences';

type LoadState = { status: 'loading' } | { status: 'loaded'; data: WordData } | { status: 'error' };

export function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [dialog, setDialog] = useState<'settings' | 'help' | null>(null);
  const [roundKey, setRoundKey] = useState(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoad({ status: 'loading' });
    loadWordData().then(
      (data) => { if (active) setLoad({ status: 'loaded', data }); },
      () => { if (active) setLoad({ status: 'error' }); },
    );
    return () => { active = false; };
  }, [retry]);
  useEffect(() => { savePreferences(preferences); }, [preferences]);

  return (
    <div className="app-shell" data-theme={preferences.theme}>
      <div className="app">
        <header className="masthead">
          <h1 className="wordmark"><span className="brand-symbol" aria-hidden="true">w.</span>Word practice</h1>
          <div className="header-actions">
            <button className="quiet" onClick={() => setDialog('help')}>How to play</button>
            <button className="settings-button" onClick={() => setDialog('settings')}>Settings <span aria-hidden="true">↗</span></button>
          </div>
        </header>
        {load.status === 'loading' && <main className="load-screen"><p role="status">Loading word lists…</p></main>}
        {load.status === 'error' && <main className="load-screen"><p role="alert">Could not load word lists. Please try again.</p>
          <button className="primary" onClick={() => setRetry((count) => count + 1)}>Try again</button>
        </main>}
        {load.status === 'loaded' && <Play key={roundKey} data={load.data} pendingRules={preferences.rules} />}
        <footer className="site-footer"><span>ENGLISH WORD PRACTICE</span><a href={import.meta.env.BASE_URL + 'words/COPYRIGHT.txt'}>Word-list credits ↗</a><span>No daily limit.</span></footer>
      </div>
      {dialog === 'settings' && <Settings preferences={preferences} onClose={() => setDialog(null)}
        onTheme={(theme) => setPreferences((current) => ({ ...current, theme }))}
        onSave={(rules, restart) => {
          setPreferences((current) => ({ ...current, rules }));
          if (restart) setRoundKey((key) => key + 1);
          setDialog(null);
        }} />}
      {dialog === 'help' && <Dialog title="Follow the letters." titleId="help-title" onClose={() => setDialog(null)}>
        <p>You get the first letter and five guesses. Type the whole word, including the first letter, or tap the keyboard, then check your word. Gray keys marked × are letters confirmed absent; you can still use them in guesses.</p>
        <ul className="help-list"><li>✓ Right place: that letter is exactly where it belongs.</li><li>↔ Elsewhere: the letter is in the answer, in another position.</li><li>× Not in word: no unmatched copy of that letter remains.</li></ul>
        <p>In a 4 → 5 → 6 round, solve a word to move up. A failed word is replaced at the same length. Unknown submitted words either cost no guess or end the word, depending on your settings.</p>
        <p>There is no daily limit. This version is untimed. <a href={import.meta.env.BASE_URL + 'fonts/README.txt'}>Typeface credits</a>.</p>
      </Dialog>}
    </div>
  );
}
