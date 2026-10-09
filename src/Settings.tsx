import { useState } from 'react';
import { Dialog } from './Dialog';
import type { Rules, WordLength } from './game';
import { themes, type Preferences, type Theme } from './preferences';

const names: Record<Theme, string> = { letterpress: 'Letterpress', afterhours: 'Afterhours', club: 'Word Club' };
export function Settings({ preferences, onTheme, onSave, onClose }: {
  preferences: Preferences; onTheme: (theme: Theme) => void; onSave: (rules: Rules, restart: boolean) => void; onClose: () => void;
}) {
  const [rules, setRules] = useState<Rules>({ ...preferences.rules });
  const [preset, setPreset] = useState(() => preferences.rules.invalid === 'reject' && preferences.rules.length === 5
    ? preferences.rules.format === 'single' ? 'practice' : 'sequence' : 'custom');
  function save(element: HTMLElement, restart: boolean) {
    element.closest('dialog')?.close();
    onSave(rules, restart);
  }
  function change(update: Partial<Rules>) {
    setRules((current) => ({ ...current, ...update }));
    setPreset('custom');
  }
  return (
    <Dialog title="Your kind of wordplay." titleId="settings-title" onClose={onClose}>
      <p className="dialog-copy">Appearance changes immediately. Game rules apply to your next round.</p>
      <form onSubmit={(event) => { event.preventDefault(); save(event.currentTarget, false); }}>
        <div className="field"><label htmlFor="appearance">Appearance</label>
          <select id="appearance" value={preferences.theme} onChange={(event) => onTheme(event.target.value as Theme)}>
            {themes.map((theme) => <option value={theme} key={theme}>{names[theme]}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="preset">Starting point</label>
          <select id="preset" value={preset} onChange={(event) => {
            const value = event.target.value;
            setPreset(value);
            if (value !== 'custom') setRules({ format: value === 'sequence' ? 'sequence' : 'single', length: 5, invalid: 'reject' });
          }}>
            <option value="practice">Practice · untimed</option>
            <option value="sequence">4 → 5 → 6 · untimed</option>
            <option value="custom">Custom</option>
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
        <div className="field"><label htmlFor="invalid">Unknown submitted word</label>
          <select id="invalid" value={rules.invalid} onChange={(event) => change({ invalid: event.target.value as Rules['invalid'] })}>
            <option value="reject">Reject · keep trying</option><option value="fail">End the current word</option>
          </select>
        </div>
        <p className="settings-footnote">Five attempts. First letter supplied. Clocks are off.<br />Timed modes will follow; this version is untimed.</p>
        <div className="settings-actions">
          <button className="primary" type="submit">Save for next round</button>
          <button className="secondary" type="button" onClick={(event) => save(event.currentTarget, true)}>Start new round now</button>
        </div>
        <p className="settings-footnote">Starting now replaces your current round. Saving does not.</p>
      </form>
    </Dialog>
  );
}
