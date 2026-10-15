import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { isSequenceComplete, isRoundClockPaused, giveUp, nextWord, startRound, submitGuess, keyboardFeedback, type LetterFeedback, type Round, type Rules } from './game';
import type { WordData } from './wordLists';
import { useRoundClock } from './useRoundClock';
import { describeRules, sameRules } from './presets';
import { recordResult } from './history';
import { AnalysisDialog } from './AnalysisDialog';

const marks: Record<LetterFeedback, string> = { correct: '✓', present: '↔', absent: '×' };
const descriptions: Record<LetterFeedback, string> = { correct: 'right place', present: 'elsewhere in word', absent: 'not in word' };
function Tile({ letter = '', feedback, supplied = false, active = false, unscored = false, rejected = false, ungraded = false }: {
  letter?: string; feedback?: LetterFeedback; supplied?: boolean; active?: boolean; unscored?: boolean; rejected?: boolean; ungraded?: boolean;
}) {
  const state = supplied ? 'correct' : feedback;
  const label = letter ? letter.toUpperCase() + (rejected ? ': not scored; word does not fit the clue' : unscored ? ': unscored; word not in list'
    : supplied ? ': supplied letter; right place' : ungraded ? ': not scored' : state ? ': ' + descriptions[state] : '') : 'empty';
  return <span role="img" className={['tile', state, (unscored || rejected) && 'unscored', rejected && 'rejected', active && !supplied && 'active', !letter && 'empty'].filter(Boolean).join(' ')} aria-label={label}>
    {letter.toUpperCase()}{(state || unscored || rejected) && <span className="tile-mark" aria-hidden="true">{rejected ? '✕' : unscored ? '?' : marks[state!]}</span>}
  </span>;
}

function Clock({ label, deadline, now, duration }: { label: string; deadline: number; now: number; duration: number }) {
  const remaining = Math.min(duration, Math.max(0, (deadline - now) / 1000));
  const seconds = Math.ceil(remaining);
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return <span className="clock-pill clock-with-progress" data-low={seconds <= 5 || undefined}>
    <span className="clock-readout">
      <span className="clock-name">{label}</span>
      <span>
        <span role="timer" aria-label={label + ' time remaining'} aria-live="off">{text}</span>
        {seconds <= 5 && <span className="clock-warning" aria-hidden="true">!</span>}
      </span>
    </span>
    <progress className="timer-progress" max={duration} value={remaining}
      aria-label={label + ' time remaining'} aria-valuetext={`${seconds} of ${duration} seconds remaining`} />
  </span>;
}

/** "3 guesses", or "3 tries" for a clue puzzle. */
function count(value: number, tries: boolean) {
  return `${value} ${tries ? (value === 1 ? 'try' : 'tries') : value === 1 ? 'guess' : 'guesses'}`;
}

export function Play({ data, pendingRules }: { data: WordData; pendingRules: Rules }) {
  const [round, setRound] = useState(() => startRound(data, pendingRules));
  const now = useRoundClock(round, setRound);
  const [entry, setEntry] = useState('');
  const [message, setMessage] = useState('');
  const [analysisRound, setAnalysisRound] = useState<Round | null>(null);
  const entryRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const allowed = useMemo(() => new Set(data.guesses[round.length]), [data, round.length]);
  const sequence = round.rules.format === 'sequence';
  const completed = isSequenceComplete(round);
  const paused = isRoundClockPaused(round);
  const active = round.status === 'playing';
  const retainEntry = round.reason === 'word-time' || round.reason === 'round-time' || round.reason === 'given-up';
  const clue = round.clue;
  // Clue puzzles supply no first letter.
  const first = clue ? null : round.answer[0].toUpperCase();
  const attempt = clue ? 'Try' : 'Guess';
  const maxGuesses = round.rules.maxGuesses;
  const knowledge = keyboardFeedback(clue ? [clue, ...round.guesses] : round.guesses);
  // Record each finished word; repeat observations and a later round expiry replace, never duplicate.
  useEffect(() => { recordResult(round); }, [round]);
  useEffect(() => {
    if (maxGuesses === null && boardRef.current) boardRef.current.scrollTop = boardRef.current.scrollHeight;
  }, [maxGuesses, round.guesses.length, round.answer, round.status]);

  function focusForPhysicalTyping() {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) entryRef.current?.focus({ preventScroll: true });
  }
  useEffect(() => { focusForPhysicalTyping(); }, []);
  useEffect(() => {
    if (round.status !== 'playing' && !document.querySelector('dialog[open]')) nextRef.current?.focus({ preventScroll: true });
  }, [round.status]);

  function check() {
    const result = submitGuess(round, entry, allowed);
    setRound(result.round);
    setMessage(result.message);
    // A recorded guess or an unknown word that ends the word leaves no unfinished entry. A whole word checked without
    // counting is cleared too, so the next guess can be typed at once; a short entry stays to finish, and expiry keeps it.
    if (result.round.guesses.length > round.guesses.length || result.round.reason === 'invalid'
      || (result.round.status === 'playing' && entry.length === round.length)) setEntry('');
    if (result.round.status === 'playing') focusForPhysicalTyping();
  }
  function abandonWord() {
    setRound(giveUp(round));
    setMessage('');
  }
  function continuePlay() {
    setAnalysisRound(null);
    setRound(nextWord(round, data, pendingRules));
    setEntry('');
    setMessage('');
    // Never summon the native keyboard for a touch-only next-word action.
    requestAnimationFrame(focusForPhysicalTyping);
  }
  function key(letter: string) {
    setEntry((value) => letter === 'Backspace' ? value.slice(0, -1) : (value + letter).slice(0, round.length));
    setMessage('');
    focusForPhysicalTyping();
  }

  useEffect(() => {
    if (!active) return;
    function acceptsGameInput(target: EventTarget | null) {
      return !document.querySelector('dialog[open]') && !(target instanceof HTMLElement
        && (target.isContentEditable || target.closest('input, textarea, select')));
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!acceptsGameInput(event.target) || event.defaultPrevented || event.isComposing
        || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Enter') {
        // Preserve ordinary Enter activation for navigation and dialog controls.
        if (event.target instanceof Element && event.target.closest('button, a')) return;
        event.preventDefault();
        if (!event.repeat) check();
      } else if (event.key === 'Backspace' || /^[a-z]$/i.test(event.key)) {
        event.preventDefault();
        entryRef.current?.focus({ preventScroll: true });
        key(event.key === 'Backspace' ? event.key : event.key.toUpperCase());
      }
    }
    function onPaste(event: ClipboardEvent) {
      if (!acceptsGameInput(event.target) || event.defaultPrevented) return;
      const letters = event.clipboardData?.getData('text/plain').replace(/[^a-z]/gi, '').toUpperCase();
      if (!letters) return;
      event.preventDefault();
      setEntry(letters.slice(0, round.length));
      setMessage('');
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('paste', onPaste);
    };
  }, [active, entry, round, allowed]);

  const rowCount = maxGuesses ?? Math.max(5, round.guesses.length + (active || (retainEntry && entry.length > 0) ? 1 : 0));
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const guess = round.guesses[index];
    const editing = active && index === round.guesses.length;
    const unfinished = retainEntry && entry.length > 0 && index === round.guesses.length;
    const showEntry = editing || unfinished;
    return (
      <div className="board-row" key={index} role="group" aria-label={`${attempt} ${index + 1}${guess?.rejection ? `: rejected; ${guess.rejection}`
        : guess?.feedback === null ? ': not in word list' : unfinished ? ': not scored' : ''}`}>
        {Array.from({ length: round.length }, (_, column) => {
          const letter = guess ? guess.word[column] : showEntry ? entry[column] || (column === 0 && first ? first : '') : '';
          const supplied = showEntry && column === 0 && first !== null && (!entry[0] || entry[0] === first);
          return <Tile key={column} letter={letter} feedback={guess?.feedback?.[column]} unscored={guess?.feedback === null && !guess.rejection}
            rejected={Boolean(guess?.rejection)} ungraded={unfinished} supplied={supplied} active={editing} />;
        })}
      </div>
    );
  });
  const resultTitle = round.status === 'expired' ? 'Round time is up.' : round.reason === 'word-time' ? 'Word time is up.'
    : round.reason === 'given-up' ? 'Word given up.'
    : round.status === 'won' ? completed ? 'Round complete.' : 'Nicely found.' : 'That one got away.';
  // A word lost on a rejected try keeps its reason beside the answer.
  const finalRejection = round.status === 'lost' && round.reason === 'attempts' ? round.guesses.at(-1)?.rejection : undefined;
  const nextLabel = round.status === 'expired' ? 'New round' : sequence && !completed ? round.status === 'won' ? 'Next length' : 'Another ' + round.length + '-letter word' : sequence ? 'New round' : 'Next word';

  return (
    <main className="composition">
      {!sameRules(round.rules, pendingRules) && <p className="pending-settings" aria-live="polite">
        <strong>Saved for next round.</strong> {describeRules(pendingRules)}. This round is unchanged.
      </p>}
      <section className="play-area" aria-label="Word puzzle">
        <div className="play-header"><div>
          <p className="eyebrow">{sequence ? '4 → 5 → 6 ROUND' : clue ? 'SINGLE WORD · CLUE' : 'SINGLE WORD'}</p>
          <h2>Find the {({ 4: 'four', 5: 'five', 6: 'six' })[round.length]}.</h2>
        </div><div className="clock-strip" aria-label="Clocks">
          {round.wordDeadline !== null && <Clock label={round.rules.wordClock.mode === 'guess' ? 'Guess' : 'Word'}
            deadline={round.wordDeadline} now={active ? now : round.endedAt ?? now} duration={round.rules.wordClock.seconds} />}
          {round.roundDeadline !== null && <Clock label="Round" deadline={round.roundDeadline}
            now={paused || round.status === 'expired' ? round.endedAt ?? now : now} duration={round.rules.roundSeconds!} />}
          {round.wordDeadline === null && round.roundDeadline === null && <span className="clock-pill"><span aria-hidden="true">∞ </span>Untimed</span>}
        </div></div>
        {sequence && <ol className="sequence" aria-label="Sequence progress">
          {([4, 5, 6] as const).map((length) => <li key={length} aria-current={length === round.length ? 'step' : undefined}>
            {length} letters {length < round.length ? '✓' : ''}{length === round.length && <b>{completed ? 'DONE' : 'NOW'}</b>}
          </li>)}
        </ol>}
        <div className="puzzle-meta">
          <span>{maxGuesses === null
            ? active ? `${attempt} ${round.guesses.length + 1} · Unlimited` : count(round.guesses.length, clue !== null) + ' used'
            : active ? `${attempt} ${round.guesses.length + 1} of ${maxGuesses}` : `${round.guesses.length} of ${maxGuesses} ${clue ? 'tries' : 'guesses'} used`}</span>
          <span>{clue ? 'One clue given' : `${round.length} letters · first letter given`}</span>
        </div>
        {clue && <div className="board clue-board" role="group" aria-label={`Given clue: ${clue.word.toUpperCase()}`}
          style={{ '--length': round.length } as CSSProperties}>
          <p className="clue-label" aria-hidden="true">Clue</p>
          <div className="board-row">{[...clue.word].map((letter, column) => <Tile key={column} letter={letter} feedback={clue.feedback[column]} />)}</div>
        </div>}
        <div ref={boardRef} className="board" data-unlimited={maxGuesses === null || undefined}
          tabIndex={maxGuesses === null ? 0 : undefined}
          style={{ '--length': round.length } as CSSProperties} role="group" aria-label="Guess board">{rows}</div>
        {maxGuesses === null && round.guesses.length >= 5 && <p className="board-history">Scroll the board to see earlier guesses.</p>}
        {!active && <div className="result" role="status">
          <div><h3>{resultTitle}</h3><p>The word was <strong>{round.answer.toUpperCase()}</strong>.</p>
            {finalRejection && <p>{round.guesses.at(-1)!.word.toUpperCase()} doesn't fit. {finalRejection}</p>}
            {retainEntry && entry && <p>Last entry was not scored.</p>}
            {paused && !completed && round.roundDeadline !== null && <p>Round timer paused until you continue.</p>}
            {round.reason === 'invalid' && <p>Unknown submitted word: this word has ended.</p>}
            {round.status === 'expired' && <p>The whole round has ended. Start a new round to try again.</p>}
            {sequence && round.status === 'lost' && <p>Solve another {round.length}-letter word to move on.</p>}
          </div>
          <div className="result-actions">
            <button ref={nextRef} className="primary" onClick={continuePlay}>{nextLabel} <span aria-hidden="true">→</span></button>
            <button className="secondary" onClick={() => setAnalysisRound(round)}>Analyse guesses</button>
          </div>
        </div>}
        {active && <p id="feedback" className="feedback" role="status">{message || (first ? `Your next guess starts with ${first}.` : 'Only one word fits the clue.')}</p>}
        <div className="legend" aria-label="Letter feedback legend">
          <span><i className="correct" aria-hidden="true">✓</i> Right place</span>
          <span><i className="present" aria-hidden="true">↔</i> Elsewhere</span>
          <span><i className="absent" aria-hidden="true">×</i> Not in word</span>
        </div>
        {active && <>
          <div className="input-label">Your guess <span>{first ? `Starts with ${first}` : 'Must fit the clue'}</span></div>
          <div ref={entryRef} id="guess-entry" className="guess-display" role="group" tabIndex={0}
            aria-label="Your guess" aria-describedby="current-guess entry-instructions feedback">
            <span id="current-guess" className="guess-value">{entry}</span>
            {!entry && <span className="guess-placeholder">Tap letters below</span>}
          </div>
          <span id="entry-instructions" className="sr-only">Enter the whole word using the letter keys. Enter checks your guess; Backspace deletes a letter. Physical typing and pasting also work.</span>
          <span id="unavailable-key-description" className="sr-only">Not in word. You can still type this letter.</span>
          <span id="correct-key-description" className="sr-only">Right place in a checked guess. You can still type this letter.</span>
          <span id="present-key-description" className="sr-only">Elsewhere in the word. You can still type this letter.</span>
          <div className="keyboard" role="group" aria-label="On-screen keyboard">
            {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((letters, row) => <div className="key-row" key={letters}>
              {row === 1 && <span className="key-spacer" aria-hidden="true" />}
              {row === 2 && <button className="key key-command" type="button" aria-label="Check guess" onClick={check}>ENTER</button>}
              {[...letters].map((letter) => {
                const feedback = knowledge.get(letter.toLowerCase());
                const state = feedback === 'absent' ? 'unavailable' : feedback;
                return <button className={state ? 'key ' + state : 'key'} key={letter} type="button"
                  aria-describedby={state ? state + '-key-description' : undefined} onClick={() => key(letter)}>
                  {letter}{feedback && <span className="key-mark" aria-hidden="true">{marks[feedback]}</span>}
                </button>;
              })}
              {row === 1 && <span className="key-spacer" aria-hidden="true" />}
              {row === 2 && <button className="key key-command backspace" aria-label="Delete last letter" type="button" onClick={() => key('Backspace')}>⌫</button>}
            </div>)}
          </div>
          {maxGuesses === null && <button type="button" className="secondary give-up" onClick={abandonWord}>Give up</button>}
        </>}
        <p className="play-footer">{round.wordDeadline !== null || round.roundDeadline !== null
          ? paused && !completed ? 'Timers paused until you continue.' : 'Clocks keep running during play, including across tabs.'
          : `${maxGuesses === null ? `Unlimited ${clue ? 'tries' : 'guesses'}` : count(maxGuesses, clue !== null)}. A fresh word whenever you like.`}</p>
      </section>
      {analysisRound && <AnalysisDialog round={analysisRound} data={data} onClose={() => setAnalysisRound(null)} />}
    </main>
  );
}
