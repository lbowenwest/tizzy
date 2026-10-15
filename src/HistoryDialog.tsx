import { useState, type CSSProperties } from 'react';
import { Dialog } from './Dialog';
import type { Rules } from './game';
import { clearHistory, loadHistory, summarizeHistory, type HistoryRecord } from './history';
import { getPresetKey, presets } from './presets';

const recentLimit = 50;
const order = [...presets.map(({ key }) => key), 'custom'];
const rank = (group: string) => order.includes(group) ? order.indexOf(group) : order.length;
const groupLabel = (group: string) => presets.find(({ key }) => key === group)?.label ?? 'Custom';
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

export function HistoryDialog({ rules, onClose }: { rules: Rules; onClose: () => void }) {
  const [records, setRecords] = useState(loadHistory);
  const [confirming, setConfirming] = useState(false);
  const summaries = summarizeHistory(records);
  const groups = [...summaries.keys()].sort((a, b) => rank(a) - rank(b));
  const [group, setGroup] = useState(() => summaries.has(getPresetKey(rules)) ? getPresetKey(rules) : records.at(-1)?.group ?? '');
  const summary = summaries.get(group);
  const largest = Math.max(1, ...(summary?.guessDistribution.map(({ count }) => count) ?? []));

  return (
    <Dialog title="Your history." titleId="history-title" onClose={onClose}>
      {summary === undefined ? <p className="history-empty">No finished words yet.</p> : <div className="history">
        <p className="dialog-copy">Finished words on this device. Grouped by preset; every other configuration counts as Custom.</p>
        <div className="field"><label htmlFor="history-group">Group</label>
          <select id="history-group" value={group} onChange={(event) => setGroup(event.target.value)}>
            {groups.map((key) => <option key={key} value={key}>{groupLabel(key)}</option>)}
          </select>
        </div>
        <dl className="history-stats" aria-label={groupLabel(group) + ' statistics'}>
          <div><dt>Played</dt><dd>{summary.played}</dd></div>
          <div><dt>Solved</dt><dd>{Math.round(summary.solved / summary.played * 100)}%</dd></div>
          <div><dt>Current streak</dt><dd>{summary.currentStreak}</dd></div>
          <div><dt>Best streak</dt><dd>{summary.bestStreak}</dd></div>
          <div><dt>Average solve</dt><dd>{summary.averageSolveMs === null ? '—' : duration(summary.averageSolveMs)}</dd></div>
          {summary.rounds && <>
            <div><dt>Rounds completed</dt><dd>{summary.rounds.completed}</dd></div>
            <div><dt>Round time ran out</dt><dd>{summary.rounds.expired}</dd></div>
          </>}
        </dl>
        <h3>Guesses to solve</h3>
        {summary.guessDistribution.length === 0 ? <p>No solved words yet.</p>
          : <ol className="guess-distribution" aria-label="Guesses to solve">
            {summary.guessDistribution.map(({ guesses, count }) => <li key={guesses} aria-label={`${guessCount(guesses)}: ${wordCount(count)}`}>
              <span aria-hidden="true">{guesses}</span>
              <span className="distribution-bar" aria-hidden="true" style={{ '--share': count / largest } as CSSProperties} />
              <span aria-hidden="true">{count}</span>
            </li>)}
          </ol>}
        <h3>Recent words</h3>
        <ol className="recent-words" aria-label="Recent words">
          {records.slice(-recentLimit).reverse().map((record) => <li key={record.id} data-result={record.result}>
            <strong>{record.answer.toUpperCase()}</strong>
            <span>{outcome(record)}</span>
            <span>{guessCount(record.guesses)}</span>
            <span>{groupLabel(record.group)}</span>
          </li>)}
        </ol>
        <div className="history-clear">
          {confirming ? <>
            <p>Clear all finished words from this device? This cannot be undone.</p>
            <div className="settings-actions">
              <button type="button" className="primary" onClick={() => { clearHistory(); setRecords([]); setConfirming(false); }}>Confirm clear</button>
              <button type="button" className="secondary" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </> : <button type="button" className="secondary" onClick={() => setConfirming(true)}>Clear history</button>}
        </div>
      </div>}
    </Dialog>
  );
}
