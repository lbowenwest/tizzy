import { useEffect, useState } from 'react';
import { loadWordData, type WordData } from './wordLists';
import { Play } from './Play';
import { Dialog } from './Dialog';
import { Settings } from './Settings';
import { HistoryDialog } from './HistoryDialog';
import { loadPreferences, savePreferences, type Preferences } from './preferences';
import { presetRules } from './presets';

type LoadState = { status: 'loading' } | { status: 'loaded'; data: WordData } | { status: 'error' };

export function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [dialog, setDialog] = useState<'settings' | 'help' | 'history' | null>(null);
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
          <h1 className="wordmark"><span className="brand-symbol" aria-hidden="true">t.</span>Tizzy</h1>
          <div className="header-actions">
            <button className="quiet" onClick={() => setDialog('help')}>How to play</button>
            <button className="quiet" onClick={() => setDialog('history')}>History</button>
            <button className="settings-button" onClick={() => setDialog('settings')}>Settings <span aria-hidden="true">↗</span></button>
          </div>
        </header>
        {load.status === 'loading' && <main className="load-screen"><p role="status">Loading word lists…</p></main>}
        {load.status === 'error' && <main className="load-screen"><p role="alert">Could not load word lists. Please try again.</p>
          <button className="primary" onClick={() => setRetry((count) => count + 1)}>Try again</button>
        </main>}
        {load.status === 'loaded' && <Play key={roundKey} data={load.data} pendingRules={presetRules(preferences.preset)} />}
        <footer className="site-footer"><span>WORD GAME</span><a href={import.meta.env.BASE_URL + 'words/COPYRIGHT.txt'}>Word-list credits ↗</a><span>No daily limit.</span></footer>
      </div>
      {dialog === 'settings' && <Settings preferences={preferences} onClose={() => setDialog(null)}
        onTheme={(theme) => setPreferences((current) => ({ ...current, theme }))}
        onSave={(preset, restart) => {
          setPreferences((current) => ({ ...current, preset }));
          if (restart) setRoundKey((key) => key + 1);
          setDialog(null);
        }} />}
      {dialog === 'history' && <HistoryDialog preset={preferences.preset} onClose={() => setDialog(null)} />}
      {dialog === 'help' && <Dialog title="Follow the letters." titleId="help-title" onClose={() => setDialog(null)}>
        <p>You get the first letter and five guesses per word. Sprint instead gives unlimited guesses with a 90-second overall clock; there, Give up reveals the answer, and you continue explicitly with another word at the same length. The round clock pauses after giving up or solving a word and resumes with the same remaining time when you continue. Tap the letter keys to enter the whole word, including the first letter, then tap ENTER. Delete removes the last letter. Physical keyboards and pasting work too; the guess display is not a text field and won't open a mobile keyboard. Keys show the strongest checked feedback: ✓ right place, ↔ elsewhere, or × absent. All keys remain usable.</p>
        <ul className="help-list"><li>✓ Right place: that letter is exactly where it belongs.</li><li>↔ Elsewhere: the letter is in the answer, in another position.</li><li>× Not in word: no unmatched copy of that letter remains.</li></ul>
        <p>In one starts each word from one checked word whose letter marks only the answer fits. No first letter is given, and you get a single try: a known word that doesn't fit the clue is rejected with the reason, without letter marks.</p>
        <p>In a 4 → 5 → 6 round, solve a word to move up. A failed word is replaced at the same length. Unknown submitted words are rejected for free in the untimed presets and In one, end the word in the Quickfire presets, and use a guess without letter clues in Sprint.</p>
        <p>There is no daily limit. Choose a preset in Settings: untimed Practice at 4, 5 or 6 letters, an untimed 4 → 5 → 6 Climb, Quickfire timed words, Sprint, or In one. The preset preview shows its rules; Apply now restarts this round, while Save for next round preserves current play. Word timeouts fail one word; the overall sequence clock ends the whole round. During play, clocks keep running across tab switches and while help or settings is open. A paused result stays paused across those events. <a href={import.meta.env.BASE_URL + 'fonts/README.txt'}>Typeface credits</a>.</p>
      </Dialog>}
    </div>
  );
}
