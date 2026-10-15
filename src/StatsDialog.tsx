import { useState, type CSSProperties } from 'react';
import { Dialog } from './Dialog';
import { clearHistory, loadHistory, summarizeHistory, type HistoryRecord } from './history';
import { defaultPreset, isPresetKey, modes, presets } from './presets';

const recentLimit = 10;
const outcomes: Record<NonNullable<HistoryRecord['reason']>, string> = {
  attempts: 'Out of guesses', invalid: 'Unknown word', 'word-time': 'Word time up', 'round-time': 'Round time up', 'given-up': 'Given up',
};
const outcome = ({ reason }: HistoryRecord) => reason === null ? 'Solved' : outcomes[reason];
const guessCount = (count: number) => `${count} ${count === 1 ? 'guess' : 'guesses'}`;
const wordCount = (count: number) => `${count} ${count === 1 ? 'word' : 'words'}`;
function duration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function StatsDialog({ preset, onClose }: { preset: string; onClose: () => void }) {
  const [records, setRecords] = useState(loadHistory);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState(() => isPresetKey(preset) ? preset : defaultPreset);
  const current = presets.find(({ key }) => key === selected)!;
  const variants = presets.filter(({ mode }) => mode === current.mode);
  const summary = summarizeHistory(records).get(selected);
  const words = records.filter(({ group }) => group === selected);
  const latest = words.at(-1);
  const failed = summary ? summary.played - summary.solved : 0;
  const largest = Math.max(1, failed, ...(summary?.guessDistribution.map(({ count }) => count) ?? []));
  // A mode opens on the variant being played, else the one played last, else its first.
  const chooseMode = (mode: string) => {
    const keys = presets.filter((entry) => entry.mode === mode).map(({ key }) => key);
    setSelected(keys.includes(preset) ? preset : records.filter(({ group }) => keys.includes(group)).at(-1)?.group ?? keys[0]);
  };
  const row = (key: string, label: string, mark: string, count: number, isLatest: boolean) =>
    <li key={key} aria-label={`${label}: ${wordCount(count)}`} data-latest={isLatest || undefined}>
      <span aria-hidden="true">{mark}</span>
      <span className="distribution-bar" aria-hidden="true" style={{ '--share': count / largest } as CSSProperties} />
      <span aria-hidden="true">{count}</span>
    </li>;

  return (
    <Dialog title="Your stats." titleId="stats-title" onClose={onClose}>
      {records.length === 0 ? <p className="stats-empty">No finished words yet.</p> : <div className="stats">
        <div className="stats-tabs stats-modes" role="group" aria-label="Mode">
          {modes.map((mode) => <button type="button" key={mode} aria-pressed={mode === current.mode} onClick={() => chooseMode(mode)}>{mode}</button>)}
        </div>
        {variants.length > 1 && <div className="stats-tabs stats-variants" role="group" aria-label={`${current.mode} variant`}>
          {variants.map(({ key, variant }) => <button type="button" key={key} aria-pressed={key === selected} onClick={() => setSelected(key)}>{variant}</button>)}
        </div>}
        {summary === undefined ? <p className="stats-empty">Not played yet.</p> : <>
          <dl className="stats-numbers" aria-label={current.label + ' statistics'}>
            <div><dt>Played</dt><dd>{summary.played}</dd></div>
            <div><dt>Solved</dt><dd>{Math.round(summary.solved / summary.played * 100)}%</dd></div>
            <div><dt>Current streak</dt><dd>{summary.currentStreak}</dd></div>
            <div><dt>Best streak</dt><dd>{summary.bestStreak}</dd></div>
          </dl>
          <dl className="stats-extra">
            <div><dt>Average solve</dt><dd>{summary.averageSolveMs === null ? '—' : duration(summary.averageSolveMs)}</dd></div>
            {summary.rounds && <>
              <div><dt>Rounds completed</dt><dd>{summary.rounds.completed}</dd></div>
              <div><dt>Round time ran out</dt><dd>{summary.rounds.expired}</dd></div>
            </>}
          </dl>
          <h3>Guess distribution</h3>
          <ol className="guess-distribution" aria-label="Guess distribution">
            {summary.guessDistribution.map(({ guesses, count }) =>
              row(String(guesses), guessCount(guesses), String(guesses), count, latest?.result === 'solved' && latest.guesses === guesses))}
            {row('failed', 'Not solved', '✗', failed, latest?.result === 'failed')}
          </ol>
          <h3>Recent words</h3>
          <ol className="recent-words" aria-label="Recent words">
            {words.slice(-recentLimit).reverse().map((record) => <li key={record.id} data-result={record.result}>
              <strong>{record.answer.toUpperCase()}</strong>
              <span>{outcome(record)}</span>
              <span>{guessCount(record.guesses)}</span>
            </li>)}
          </ol>
        </>}
        <div className="stats-clear">
          {confirming ? <>
            <p>Clear all finished words from this device? This cannot be undone.</p>
            <div className="settings-actions">
              <button type="button" className="primary" onClick={() => { clearHistory(); setRecords([]); setConfirming(false); }}>Confirm clear</button>
              <button type="button" className="secondary" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </> : <button type="button" className="secondary" onClick={() => setConfirming(true)}>Clear stats</button>}
        </div>
      </div>}
    </Dialog>
  );
}
