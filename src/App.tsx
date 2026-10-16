import { useEffect, useState } from 'react';
import { loadWordData, type WordData } from './wordLists';
import { Play } from './Play';
import { Dialog } from './Dialog';
import { Settings } from './Settings';
import { StatsDialog } from './StatsDialog';
import { loadPreferences, savePreferences, type Preferences } from './preferences';
import { presetRules } from './presets';
import { Daily, DailyStats } from './DailyClimb';

type LoadState = { status: 'loading' } | { status: 'loaded'; data: WordData } | { status: 'error' };

export function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [dialog, setDialog] = useState<'settings' | 'help' | 'stats' | null>(null);
  const [roundKey, setRoundKey] = useState(0);
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<'daily' | 'practice'>(() => typeof location !== 'undefined' && location.hash.startsWith('#daily') ? 'daily' : 'practice');
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
            <button className="quiet" onClick={() => setDialog('stats')}>Stats</button>
            <button className="settings-button" onClick={() => setDialog('settings')}>Settings <span aria-hidden="true">↗</span></button>
          </div>
        </header>
        <nav className="play-modes" aria-label="Play mode">
          <button aria-pressed={mode === 'daily'} onClick={() => { if (mode !== 'daily') { setMode('daily'); history.replaceState(null, '', '#daily/given'); } }}>Daily Climb <span>4 → 5 → 6</span></button>
          <button aria-pressed={mode === 'practice'} onClick={() => { setMode('practice'); history.replaceState(null, '', '#practice'); }}>Practice <span>All modes</span></button>
        </nav>
        {load.status === 'loading' && <main className="load-screen"><p role="status">Loading word lists…</p></main>}
        {load.status === 'error' && <main className="load-screen"><p role="alert">Could not load word lists. Please try again.</p>
          <button className="primary" onClick={() => setRetry((count) => count + 1)}>Try again</button>
        </main>}
        {load.status === 'loaded' && (mode === 'daily' ? <Daily data={load.data} /> : <Play key={roundKey} data={load.data} pendingRules={presetRules(preferences.preset)} />)}
        <footer className="site-footer"><span>WORD GAME</span><a href={import.meta.env.BASE_URL + 'words/COPYRIGHT.txt'}>Word-list credits ↗</a><span>{mode === 'daily' ? 'A new climb every day.' : 'Unlimited practice.'}</span></footer>
      </div>
      {dialog === 'settings' && <Settings preferences={preferences} onClose={() => setDialog(null)}
        onTheme={(theme) => setPreferences((current) => ({ ...current, theme }))}
        onSave={(preset, restart) => {
          setPreferences((current) => ({ ...current, preset }));
          if (restart) { setRoundKey((key) => key + 1); setMode('practice'); history.replaceState(null, '', '#practice'); }
          setDialog(null);
        }} />}
      {dialog === 'stats' && (mode === 'daily' && load.status === 'loaded' ? <DailyStats data={load.data} onClose={() => setDialog(null)} /> : <StatsDialog preset={preferences.preset} onClose={() => setDialog(null)} />)}
      {dialog === 'help' && <Dialog title="Follow the letters." titleId="help-title" onClose={() => setDialog(null)}>
        <p>Find the hidden word. Tap the letter keys to enter the whole word, including any given first letter, then tap ENTER. Delete removes the last letter. You can also type or paste with a physical keyboard.</p>
        <ul className="help-list"><li>✓ Right place: that letter is exactly where it belongs.</li><li>↔ Elsewhere: the letter is in the answer, in another position.</li><li>× Not in word: no unmatched copy of that letter remains.</li></ul>
        <p>The keyboard remembers your strongest letter clues. Every key stays usable.</p>
        <dl className="help-modes">
          <dt>Practice</dt><dd>Choose 4, 5 or 6 letters, with the first letter given or hidden. Five guesses per word, no time limit. Unknown words do not use a guess.</dd>
          <dt>Climb</dt><dd>Solve a 4-letter word, then 5, then 6. Five guesses per word, no time limit, with either hint variant. If you run out of guesses, try another word at the same length.</dd>
          <dt>In one</dt><dd>One marked word is your clue. Only one answer fits, and you have one try to find it. No first letter is given. A word in the list that breaks the clue uses your only try; an unknown word does not.</dd>
          <dt>Quickfire</dt><dd>Five guesses, with 10 seconds for each guess. Each accepted guess resets the clock. Running out of time or submitting an unknown word ends that word.</dd>
          <dt>Sprint</dt><dd>Complete a 4 → 5 → 6 climb with 90 seconds in total and unlimited guesses. Unknown words get no letter marks. Give up reveals the answer; retry at the same length. The clock pauses after a solve or Give up and resumes when you continue.</dd>
          <dt>Daily Climb</dt><dd>A new 4 → 5 → 6 course each day, with separate words for each hint variant. Unlimited guesses and no time limit: race on total time. Unknown words do not use a guess. Each word’s clock runs until solved, including across tabs and reloads, and pauses between words.</dd>
        </dl>
        <h3>Daily results</h3>
        <p>New courses arrive at 00:00 UTC. Finish all three words to compare splits, copy a spoiler-free result or analyse your guesses. Progress and results save in this browser, separately for each hint variant. You can finish an older saved climb; its result belongs to the puzzle date.</p>
        <h3>Settings and clocks</h3>
        <p>Choose a practice preset in Settings. Apply now starts that preset; Save for next round keeps current play unchanged. Daily Climb progress is kept. During play, timers keep running across tab switches and while dialogs are open. A paused result stays paused until you continue.</p>
        <p><a href={import.meta.env.BASE_URL + 'fonts/README.txt'}>Typeface credits</a>.</p>
      </Dialog>}
    </div>
  );
}
