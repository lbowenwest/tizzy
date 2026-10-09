import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { attempts, isSequenceComplete, nextWord, startRound, submitGuess, unavailableLetters, type LetterFeedback, type Rules } from './game';
import type { WordData } from './wordLists';

const marks: Record<LetterFeedback, string> = { correct: '✓', present: '↔', absent: '×' };
const descriptions: Record<LetterFeedback, string> = { correct: 'right place', present: 'elsewhere in word', absent: 'not in word' };
function Tile({ letter = '', feedback, supplied = false, active = false }: {
  letter?: string; feedback?: LetterFeedback; supplied?: boolean; active?: boolean;
}) {
  const state = supplied ? 'correct' : feedback;
  const label = letter ? letter.toUpperCase() + (supplied ? ': supplied letter; right place' : state ? ': ' + descriptions[state] : '') : 'empty';
  return <span role="img" className={['tile', state, active && !supplied && 'active', !letter && 'empty'].filter(Boolean).join(' ')} aria-label={label}>
    {letter.toUpperCase()}{state && <span className="tile-mark" aria-hidden="true">{marks[state]}</span>}
  </span>;
}

export function Play({ data, pendingRules }: { data: WordData; pendingRules: Rules }) {
  const [round, setRound] = useState(() => startRound(data, pendingRules));
  const [entry, setEntry] = useState('');
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const allowed = useMemo(() => new Set(data.guesses[round.length]), [data, round.length]);
  const sequence = round.rules.format === 'sequence';
  const completed = isSequenceComplete(round);
  const active = round.status === 'playing';
  const first = round.answer[0].toUpperCase();
  const unavailable = unavailableLetters(round.guesses);

  function focusForPhysicalTyping() {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) inputRef.current?.focus({ preventScroll: true });
  }
  useEffect(() => { focusForPhysicalTyping(); }, []);

  function check() {
    const result = submitGuess(round, entry, allowed);
    setRound(result.round);
    setMessage(result.message);
    if (result.round.guesses.length > round.guesses.length) setEntry('');
    if (result.round.status !== 'playing') requestAnimationFrame(() => nextRef.current?.focus({ preventScroll: true }));
    else focusForPhysicalTyping();
  }
  function continuePlay() {
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

  const rows = Array.from({ length: attempts }, (_, index) => {
    const guess = round.guesses[index];
    const editing = active && index === round.guesses.length;
    return (
      <div className="board-row" key={index} role="group" aria-label={`Guess ${index + 1}`}>
        {Array.from({ length: round.length }, (_, column) => {
          const letter = guess ? guess.word[column] : editing ? entry[column] || (column === 0 ? first : '') : '';
          const supplied = editing && column === 0 && (!entry[0] || entry[0] === first);
          return <Tile key={column} letter={letter} feedback={guess?.feedback[column]} supplied={supplied} active={editing} />;
        })}
      </div>
    );
  });
  const resultTitle = round.status === 'won' ? completed ? 'Round complete.' : 'Nicely found.' : 'That one got away.';
  const nextLabel = sequence && !completed ? round.status === 'won' ? 'Next length' : 'Another ' + round.length + '-letter word' : sequence ? 'New round' : 'Next word';

  return (
    <main className="composition">
      <section className="play-area" aria-label="Word puzzle">
        <div className="play-header"><div>
          <p className="eyebrow">{sequence ? '4 → 5 → 6 ROUND' : 'SINGLE WORD'}</p>
          <h2>Find the {({ 4: 'four', 5: 'five', 6: 'six' })[round.length]}.</h2>
        </div><div className="clock-pill"><span aria-hidden="true">∞ </span>Untimed</div></div>
        {sequence && <ol className="sequence" aria-label="Sequence progress">
          {([4, 5, 6] as const).map((length) => <li key={length} aria-current={length === round.length ? 'step' : undefined}>
            {length} letters {length < round.length ? '✓' : ''}{length === round.length && <b>{completed ? 'DONE' : 'NOW'}</b>}
          </li>)}
        </ol>}
        <div className="puzzle-meta">
          <span>{active ? `Guess ${round.guesses.length + 1} of ${attempts}` : `${round.guesses.length} of ${attempts} guesses used`}</span>
          <span>{round.length} letters · first letter given</span>
        </div>
        <div className="board" style={{ '--length': round.length } as CSSProperties} role="group" aria-label="Five-guess board">{rows}</div>
        {!active && <div className="result" role="status">
          <div><h3>{resultTitle}</h3><p>The word was <strong>{round.answer.toUpperCase()}</strong>.</p>
            {round.reason === 'invalid' && <p>Unknown submitted word: this word has ended.</p>}
            {sequence && round.status === 'lost' && <p>Solve another {round.length}-letter word to move on.</p>}
          </div>
          <button ref={nextRef} className="primary" onClick={continuePlay}>{nextLabel} <span aria-hidden="true">→</span></button>
        </div>}
        {active && <p id="feedback" className="feedback" role="status">{message || `Your next guess starts with ${first}.`}</p>}
        <div className="legend" aria-label="Letter feedback legend">
          <span><i className="correct" aria-hidden="true">✓</i> Right place</span>
          <span><i className="present" aria-hidden="true">↔</i> Elsewhere</span>
          <span><i className="absent" aria-hidden="true">×</i> Not in word</span>
        </div>
        {active && <>
          <label className="input-label" htmlFor="guess-input">Your guess <span>Starts with {first}</span></label>
          <form className="entry" onSubmit={(event) => { event.preventDefault(); check(); }}>
            <input ref={inputRef} id="guess-input" aria-label="Your guess" aria-describedby="feedback"
              value={entry} onChange={(event) => { setEntry(event.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, round.length)); setMessage(''); }}
              placeholder="Type the whole word" maxLength={round.length} autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="done" />
            <button className="primary" type="submit" aria-label="Check guess">Check <span aria-hidden="true">↵</span></button>
          </form>
          <span id="unavailable-key-description" className="sr-only">Not in word. You can still type this letter.</span>
          <div className="keyboard" aria-label="On-screen keyboard">
            {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((letters) => <div className="key-row" key={letters}>
              {[...letters].map((letter) => {
                const absent = unavailable.has(letter.toLowerCase());
                return <button className={absent ? 'key unavailable' : 'key'} key={letter} type="button"
                  aria-describedby={absent ? 'unavailable-key-description' : undefined} onClick={() => key(letter)}>
                  {letter}{absent && <span className="key-mark" aria-hidden="true">×</span>}
                </button>;
              })}
              {letters.startsWith('Z') && <button className="key backspace" aria-label="Delete last letter" type="button" onClick={() => key('Backspace')}>⌫</button>}
            </div>)}
          </div>
        </>}
        <p className="play-footer">Five guesses. A fresh word whenever you like.</p>
      </section>
    </main>
  );
}
