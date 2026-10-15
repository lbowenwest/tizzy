import { useState } from 'react';
import { Dialog } from './Dialog';
import { themes, type Preferences, type Theme } from './preferences';
import { describeRules, presetLabel, presetRules, presets } from './presets';

const names: Record<Theme, string> = { letterpress: 'Letterpress', afterhours: 'Afterhours', club: 'Word Club' };
export function Settings({ preferences, onTheme, onSave, onClose }: {
  preferences: Preferences; onTheme: (theme: Theme) => void; onSave: (preset: string, restart: boolean) => void; onClose: () => void;
}) {
  const [preset, setPreset] = useState(preferences.preset);

  return (
    <Dialog title="Game settings." titleId="settings-title" onClose={onClose}>
      <form className="settings-form" onSubmit={(event) => {
        event.preventDefault();
        const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        event.currentTarget.closest('dialog')?.close();
        onSave(preset, button?.value === 'restart');
      }}>
        <div className="settings-fields">
          <p className="dialog-copy">Choose a preset to preview. Appearance changes immediately.</p>
          <div className="field"><label htmlFor="preset">Preset</label>
            <select id="preset" value={preset} onChange={(event) => setPreset(event.target.value)}>
              {presets.map((entry) => <option value={entry.key} key={entry.key}>{entry.label}</option>)}
            </select>
          </div>
          <section className="settings-preview" aria-label="Settings preview">
            <p className="eyebrow">{presetLabel(preset)} · Preview</p>
            <p>{describeRules(presetRules(preset))}</p>
          </section>
          <div className="field"><label htmlFor="appearance">Appearance</label>
            <select id="appearance" value={preferences.theme} onChange={(event) => onTheme(event.target.value as Theme)}>
              {themes.map((theme) => <option value={theme} key={theme}>{names[theme]}</option>)}
            </select>
          </div>
          <p className="settings-footnote">First letter supplied, except in In one: one checked word is given that only the answer fits, and words that don't fit are rejected with the reason. During play, clocks keep running in the background and while dialogs are open. Solves and Give up pause the round timer until you continue. A spent guess resets per-guess time; a free rejection does not. ITV-style presets adapt the timing for solo practice, without teams or prizes.</p>
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
