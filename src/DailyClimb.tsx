import { useEffect, useRef, useState } from 'react';
import { Puzzle } from './Play';
import { AnalysisDialog } from './AnalysisDialog';
import { Dialog } from './Dialog';
import type { Round } from './game';
import type { WordData } from './wordLists';
import { continueDaily, dailyComplete, dailyDate, dailyElapsed, dailyStats, dailyStorageKey, formatElapsed,
  loadDaily, saveDaily, shareDaily, startDaily, variantLabel, wordElapsed, type DailyRun, type DailyVariant } from './daily';

function Variants({ variant, onChange }: { variant: DailyVariant; onChange: (variant: DailyVariant) => void }) {
  return <div className="daily-variants" role="group" aria-label="Daily hint variant">
    {(['given', 'hidden'] as const).map((key) => <button key={key} type="button" aria-pressed={variant === key}
      onClick={() => onChange(key)}>{variantLabel(key)}</button>)}
  </div>;
}

function DailyResult({ run, data }: { run: DailyRun; data: WordData }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);
  const [analysis, setAnalysis] = useState<Round | null>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'manual'>('idle');
  return <section className="daily-result" aria-label="Daily result">
    <p className="eyebrow">{run.date} · {variantLabel(run.variant)}</p>
    <h2 ref={title} tabIndex={-1}>Climb complete.</h2>
    <p className="daily-total"><span>{formatElapsed(dailyElapsed(run))}</span> total time</p>
    <p>Three words, your own route. Here’s where the time went.</p>
    <table className="daily-splits">
      <caption className="sr-only">Time and guesses by word</caption>
      <thead><tr><th scope="col">Word</th><th scope="col">Split</th><th scope="col">Guesses</th><th scope="col"><span className="sr-only">Review</span></th></tr></thead>
      <tbody>{run.stages.map((stage) => <tr key={stage.length}>
        <th scope="row">{stage.length} letters</th><td>{formatElapsed(wordElapsed(stage))}</td><td>{stage.guesses.length}</td>
        <td><button className="quiet" aria-label={`Analyse ${stage.length}-letter word`} onClick={() => setAnalysis(stage)}>Analyse <span aria-hidden="true">↗</span></button></td>
      </tr>)}</tbody>
    </table>
    <button className="primary" onClick={async () => {
      try { await navigator.clipboard.writeText(shareDaily(run)); setCopy('copied'); }
      catch { setCopy('manual'); }
    }}>Copy result</button>
    <p role="status">{copy === 'copied' ? 'Copied. Ready to compare with a friend.' : 'A spoiler-free result with your time, splits and hint variant.'}</p>
    {copy === 'manual' && <label className="share-fallback">Copy this result<textarea readOnly value={shareDaily(run)} onFocus={(event) => event.target.select()} /></label>}
    {analysis && <AnalysisDialog round={analysis} data={data} retained onClose={() => setAnalysis(null)} />}
  </section>;
}

export function DailyStats({ data, onClose }: { data: WordData; onClose: () => void }) {
  const [variant, setVariant] = useState<DailyVariant>(() => location.hash === '#daily/hidden' ? 'hidden' : 'given');
  const [runs] = useState(loadDaily);
  const [review, setReview] = useState<DailyRun | null>(null);
  const stats = dailyStats(runs, variant);
  const completed = runs.filter((run) => run.variant === variant && dailyComplete(run)).sort((a, b) => b.date.localeCompare(a.date));
  return <Dialog title="Daily record." titleId="daily-stats-title" onClose={onClose}>
    {review ? <><button className="quiet" onClick={() => setReview(null)}>← All daily results</button><DailyResult key={`${review.date}/${review.variant}`} run={review} data={data} /></> : <>
      <Variants variant={variant} onChange={setVariant} />
      <dl className="daily-record">
        <div><dt>Completed</dt><dd>{stats.completed}</dd></div><div><dt>Day streak</dt><dd>{stats.streak}</dd></div>
        <div><dt>Best time</dt><dd>{stats.best === null ? '—' : formatElapsed(stats.best)}</dd></div>
        <div><dt>Average</dt><dd>{stats.average === null ? '—' : formatElapsed(stats.average)}</dd></div>
      </dl>
      <h3>Your climbs</h3>
      {completed.length === 0 ? <p>Finish your first daily climb to start your record.</p> : <ul className="daily-archive">
        {completed.map((run) => <li key={run.date}><button onClick={() => setReview(run)}>
          <span>{run.date}</span><strong>{formatElapsed(dailyElapsed(run))}</strong><span aria-hidden="true">↗</span>
        </button></li>)}
      </ul>}
      <p className="settings-footnote">Saved in this browser. Hint variants have separate records. Daily results retain your guesses for review; clearing browser data removes them.</p>
    </>}
  </Dialog>;
}

export function Daily({ data }: { data: WordData }) {
  const [variant, setVariant] = useState<DailyVariant>(() => location.hash === '#daily/hidden' ? 'hidden' : 'given');
  const [runs, setRuns] = useState(loadDaily);
  const [now, setNow] = useState(Date.now);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const today = dailyDate(now);
  const date = selectedDate ?? today;
  const run = runs.find((item) => item.date === date && item.variant === variant);
  const current = run?.stages.at(-1);
  useEffect(() => {
    if (current?.status === 'playing' && window.matchMedia('(max-width: 600px)').matches) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [date, variant, current?.length, current?.status]);
  // Pin a restored course just as we pin a newly started one; midnight must not replace an open word.
  useEffect(() => { if (run && selectedDate === null) setSelectedDate(run.date); }, [run, selectedDate]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    const sync = (event: StorageEvent) => {
      if (event.key === dailyStorageKey || event.key === null) setRuns(loadDaily());
    };
    window.addEventListener('storage', sync);
    return () => { clearInterval(interval); window.removeEventListener('storage', sync); };
  }, []);
  function update(next: DailyRun) {
    const result = saveDaily(next);
    setRuns((all) => [...all.filter((item) => item.date !== next.date || item.variant !== next.variant), result.run]);
    setSaveFailed(!result.saved);
    setSelectedDate(next.date);
    setNow(Date.now());
  }
  const unfinished = runs.filter((item) => item.variant === variant && item.date !== date && item.date < today && !dailyComplete(item)).sort((a, b) => b.date.localeCompare(a.date));
  return <div className="daily-session" data-playing={current?.status === 'playing' || undefined}>
    <div className="daily-toolbar">
      <Variants variant={variant} onChange={(next) => { if (next !== variant) { setVariant(next); setSelectedDate(null); history.replaceState(null, '', `#daily/${next}`); } }} />
      <span>{date} · resets 00:00 UTC</span>
    </div>
    {saveFailed && <p className="pending-settings" role="alert">Progress could not be saved in this browser. Keep this page open to finish your climb.</p>}
    {date !== today && <p className="pending-settings">You’re finishing the {date} climb. <button className="quiet" onClick={() => setSelectedDate(null)}>Go to today’s climb</button></p>}
    {!run ? <main className="daily-lobby">
      <p className="eyebrow">ONE DAILY COURSE · YOUR PACE</p>
      <h2>A little higher<br />every day.</h2>
      <p className="daily-intro">Three words. Four, five, then six letters.<br />How quickly can you reach the top?</p>
      <ol className="daily-route" aria-label="Daily course">
        {[4, 5, 6].map((length, index) => <li key={length}><span>0{index + 1}</span><strong>{length}</strong><span>letters</span></li>)}
      </ol>
      <p><strong>{variantLabel(variant)}.</strong> Unlimited guesses. No time limit.<br />Each hint variant has its own words and results.</p>
      <button className="primary daily-start" onClick={() => update(startDaily(dailyDate(), variant))}>Start daily climb <span aria-hidden="true">↗</span></button>
      <p className="daily-timing-note">The clock starts when you reveal each word and pauses when you solve it. While a word is open, time keeps counting across tabs and reloads. Your progress saves after each guess.</p>
    </main> : dailyComplete(run) ? <main className="daily-finish"><DailyResult key={`${date}/${variant}`} run={run} data={data} /><p className="daily-timing-note">{saveFailed ? 'Copy your result to keep it.' : 'Your result is saved.'} Come back after 00:00 UTC for a new course, or try the other hint variant.</p></main>
      : <Puzzle key={`${date}/${variant}/${current!.length}`} data={data} round={current!} now={now}
        setRound={(round) => { if (round !== current) update({ ...run, stages: [...run.stages.slice(0, -1), round] }); }}
        onContinue={() => update(continueDaily(run))} dailyTiming={{ word: wordElapsed(current!, now), total: dailyElapsed(run, now) }} />}
    {unfinished.length > 0 && <aside className="daily-unfinished"><h3>Finish a previous climb</h3>{unfinished.map((item) => <button key={item.date} className="quiet" onClick={() => setSelectedDate(item.date)}>Resume {item.date} →</button>)}</aside>}
  </div>;
}
