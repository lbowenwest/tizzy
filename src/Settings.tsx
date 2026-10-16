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
          <p className="dialog-copy">Choose a practice preset to preview. Appearance changes immediately.</p>
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
          <p className="settings-footnote">{preset === 'in-one'
            ? 'Use the marked word to find the only answer that fits. A word in the list that breaks the clue uses your only try; an unknown word does not.'
            : 'Practice and Climb offer both hint variants. Timers keep running during play, including while dialogs are open. See How to play for each mode’s rules.'}</p>
        </div>
        <div className="settings-apply">
          <div className="settings-actions">
            <button className="primary" type="submit" value="restart">Apply now</button>
            <button className="secondary" type="submit" value="save">Save for next round</button>
          </div>
          <p>Apply now starts this practice preset. Save uses it for your next practice round. Daily Climb progress is kept.</p>
        </div>
      </form>
    </Dialog>
  );
}
