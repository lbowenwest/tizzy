import { useState } from 'react';
import { Dialog } from './Dialog';
import { copyRules, guessOptions, type Rules, type WordLength } from './game';
import { themes, type Preferences, type Theme } from './preferences';
import { describeRules, getPresetKey, presets } from './presets';

const names: Record<Theme, string> = { letterpress: 'Letterpress', afterhours: 'Afterhours', club: 'Word Club' };
export function Settings({ preferences, onTheme, onSave, onClose }: {
  preferences: Preferences; onTheme: (theme: Theme) => void; onSave: (rules: Rules, restart: boolean) => void; onClose: () => void;
}) {
  const [rules, setRules] = useState<Rules>(() => copyRules(preferences.rules));
  // Native numeric fields need to represent incomplete edits without storing invalid rules.
  const [wordSeconds, setWordSeconds] = useState(String(rules.wordClock.seconds));
  const [roundSeconds, setRoundSeconds] = useState(String(rules.roundSeconds ?? 90));
  const [preset, setPreset] = useState(() => getPresetKey(preferences.rules));
  const roundEnabled = rules.format === 'sequence' && rules.roundSeconds !== null;
  const previewRules = { ...rules, wordClock: { ...rules.wordClock, seconds: Number(wordSeconds) },
    roundSeconds: roundEnabled ? Number(roundSeconds) : null };

  function save(element: HTMLFormElement, restart: boolean) {
    element.closest('dialog')?.close();
    const seconds = Number(wordSeconds);
    onSave({
      ...rules,
      wordClock: { ...rules.wordClock, seconds: Number.isSafeInteger(seconds) && seconds > 0 ? seconds : rules.wordClock.seconds },
      roundSeconds: roundEnabled ? Number(roundSeconds) : null,
    }, restart);
  }
  function change(update: Partial<Rules>) {
    setRules((current) => ({ ...current, ...update }));
    setPreset('custom');
  }
  function choosePreset(key: string) {
    setPreset(key);
    const selected = presets.find((entry) => entry.key === key);
    if (!selected) return;
    setRules(copyRules(selected.rules));
    setWordSeconds(String(selected.rules.wordClock.seconds));
    setRoundSeconds(String(selected.rules.roundSeconds ?? 90));
  }

  return (
    <Dialog title="Game settings." titleId="settings-title" onClose={onClose}>
      <form className="settings-form" onSubmit={(event) => {
        event.preventDefault();
        const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        save(event.currentTarget, button?.value === 'restart');
      }}>
        <div className="settings-fields">
          <p className="dialog-copy">Choose a preset to preview, or customise below. Appearance changes immediately.</p>
          <div className="field"><label htmlFor="preset">Preset</label>
            <select id="preset" value={preset} onChange={(event) => choosePreset(event.target.value)}>
              {presets.map((entry) => <option value={entry.key} key={entry.key}>{entry.label}</option>)}
              <option value="custom">Custom</option>
            </select>
          </div>
          <section className="settings-preview" aria-label="Settings preview">
            <p className="eyebrow">{presets.find((entry) => entry.key === preset)?.label ?? 'Custom settings'} · Preview</p>
            <p>{describeRules(previewRules)}</p>
          </section>
          <div className="field"><label htmlFor="appearance">Appearance</label>
            <select id="appearance" value={preferences.theme} onChange={(event) => onTheme(event.target.value as Theme)}>
              {themes.map((theme) => <option value={theme} key={theme}>{names[theme]}</option>)}
            </select>
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="format">Round format</label>
              <select id="format" value={rules.format} onChange={(event) => change({ format: event.target.value as Rules['format'] })}>
                <option value="single">Single word</option><option value="sequence">4 → 5 → 6</option>
              </select>
            </div>
            <div className="field"><label htmlFor="length">Word length</label>
              <select id="length" value={rules.length} disabled={rules.format === 'sequence'} onChange={(event) => change({ length: Number(event.target.value) as WordLength })}>
                <option value={4}>4 letters</option><option value={5}>5 letters</option><option value={6}>6 letters</option>
              </select>
            </div>
          </div>
          <div className="field"><label htmlFor="guesses">Guesses per word</label>
            <select id="guesses" value={rules.maxGuesses ?? 'unlimited'}
              onChange={(event) => change({ maxGuesses: event.target.value === 'unlimited' ? null : Number(event.target.value) })}>
              {guessOptions.map((count) => <option key={count} value={count}>{count} {count === 1 ? 'guess' : 'guesses'}</option>)}
              <option value="unlimited">Unlimited</option>
            </select>
          </div>
          <div className="field"><label htmlFor="invalid">Unknown submitted word</label>
            <select id="invalid" value={rules.invalid} onChange={(event) => change({ invalid: event.target.value as Rules['invalid'] })}>
              <option value="reject">Reject · keep trying</option><option value="consume">Use a guess</option><option value="fail">End the current word</option>
            </select>
          </div>
          <fieldset className="timing-settings">
            <legend>Timing</legend>
            <div className="form-grid">
              <div className="field"><label htmlFor="word-clock">Word clock</label>
                <select id="word-clock" value={rules.wordClock.mode}
                  onChange={(event) => change({ wordClock: { ...rules.wordClock, mode: event.target.value as Rules['wordClock']['mode'] } })}>
                  <option value="off">Off</option><option value="word">Per word</option><option value="guess">Per guess</option>
                </select>
              </div>
              <div className="field"><label htmlFor="word-seconds">Word / guess seconds</label>
                <input id="word-seconds" type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" inputMode="numeric"
                  value={wordSeconds} disabled={rules.wordClock.mode === 'off'} required={rules.wordClock.mode !== 'off'}
                  onChange={(event) => { setWordSeconds(event.target.value); setPreset('custom'); }} />
              </div>
            </div>
            <label className="round-clock-toggle" htmlFor="round-clock">
              <input id="round-clock" type="checkbox" checked={roundEnabled} disabled={rules.format !== 'sequence'}
                onChange={(event) => change({ roundSeconds: event.target.checked ? Number(roundSeconds) : null })} />
              Overall sequence clock
            </label>
            <div className="field"><label htmlFor="round-seconds">Round seconds</label>
              <input id="round-seconds" type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" inputMode="numeric"
                value={roundSeconds} disabled={!roundEnabled} required={roundEnabled}
                onChange={(event) => { setRoundSeconds(event.target.value); setPreset('custom'); }} />
            </div>
          </fieldset>
          <p className="settings-footnote">First letter supplied. During play, clocks keep running in the background and while dialogs are open. Solves and Give up pause the round timer until you continue. A spent guess resets per-guess time; a free rejection does not. ITV-style presets adapt the timing for solo practice, without teams or prizes.</p>
        </div>
        <div className="settings-apply">
          <div className="settings-actions">
            <button className="primary" type="submit" value="restart">Apply now</button>
            <button className="secondary" type="submit" value="save">Save for next round</button>
          </div>
          <p>Apply now restarts this round. Save keeps it unchanged.</p>
        </div>
      </form>
    </Dialog>
  );
}
