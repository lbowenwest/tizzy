import { useEffect, useRef, useState } from 'react';
import type { GuessAnalysis, WordAnalysis } from './analysis';
import { Dialog } from './Dialog';
import type { Guess, Round } from './game';
import type { WordData } from './wordLists';

const decimal = (value: number) => Number(value.toFixed(2)).toString();
const chance = (value: number) => `${decimal(value * 100)}%`;
const informationScore = ({ value, bestBits, before }: GuessAnalysis) =>
  value === null || before <= 1 || bestBits === 0 ? null : Math.round(Math.min(100, value.bits / bestBits * 100));

function FeedbackWord({ guess }: { guess: Guess }) {
  const marks = { correct: '✓', present: '↔', absent: '×' };
  return <span className="review-tiles" role="img" aria-label={`${guess.word.toUpperCase()}: ${guess.feedback
    ? guess.feedback.map((mark, index) => `${guess.word[index].toUpperCase()} ${mark}`).join(', ') : guess.rejection ? 'does not fit the clue' : 'not scored'}`}>
    {[...guess.word].map((letter, index) => <span key={index} aria-hidden="true" className={`review-tile ${guess.feedback?.[index] ?? 'unscored'}`}>
      {letter.toUpperCase()}<small>{guess.feedback ? marks[guess.feedback[index]] : guess.rejection ? '×' : '?'}</small>
    </span>)}
  </span>;
}

function GuessReview({ guess, solved, answers }: { guess: GuessAnalysis; solved: boolean; answers: readonly string[] }) {
  const { word, value, before, after, alternatives } = guess;
  const inAnswerList = answers.includes(word);
  const best = alternatives[0];
  const title = value === null ? 'No new clues this time.' : before === 1
    ? solved ? 'You had it pinned down.' : 'Only one word remained in the answer list.'
    : solved ? 'You found it.' : value.bits < 1e-9 ? 'This added no new information.'
    : !best ? 'A top information choice.' : after === 1 ? 'You narrowed it down to one.' : 'You narrowed the field.';
  return <>
    <div className="review-commentary">
      <h4>{title}</h4>
      {value && !inAnswerList && <p>{word.toUpperCase()} is an accepted guess, but it is not in Tizzy’s answer list.</p>}
      {value === null ? <p>This attempt was not scored. It supplied no letter information, so all {before} possibilities remained.</p>
        : before === 1 ? <p>{value.solveChance === 1 ? 'You played the only remaining answer: a certain solve. No further information was needed.'
          : `${inAnswerList ? `The earlier clues had already ruled out ${word.toUpperCase()}. ` : ''}${guess.remaining[0]?.toUpperCase()} was the only word left in that list.`}</p>
        : <>
          <p>You had <strong>{before} possible answers</strong>. {word.toUpperCase()} would leave <strong>{decimal(value.expectedRemaining)} on average</strong>.
            {Math.abs(after - value.expectedRemaining) < 1e-9 ? ` This time, ${after} remained, exactly as expected.`
              : after < value.expectedRemaining ? ` This time, just ${after} remained — a fortunate result.`
              : ` This time, ${after} remained, more than expected.`}</p>
          {best && <p><strong>{best.word.toUpperCase()}</strong> would reveal more information on average{best.solveChance === 0
            ? answers.includes(best.word) ? ', though earlier clues had already ruled it out.' : ', though it is not in Tizzy’s answer list.' : '.'}</p>}
        </>}
      {guess.lastTry && value && before > 1 && <p className="review-caution">This was your last try. An answer still in contention had a {chance(1 / before)} chance of solving; gathering information alone could not win.</p>}
    </div>
    <section className="review-remaining" aria-label="Remaining answers">
      <h4>{solved ? 'Answer found' : 'Still possible'} <span>{after}</span></h4>
      <ul>{guess.remaining.slice(0, 12).map((candidate) => <li key={candidate}>{candidate.toUpperCase()}</li>)}</ul>
      {after > 12 && <details><summary>Show all {after} words</summary>
        <ul>{guess.remaining.slice(12).map((candidate) => <li key={candidate}>{candidate.toUpperCase()}</li>)}</ul>
      </details>}
    </section>
    {value && before > 1 && <details className="review-comparison" onToggle={(event) => {
      if (event.currentTarget.open) event.currentTarget.querySelector('table')?.scrollIntoView({ block: 'nearest' });
    }}>
      <summary>Compare the choices <span>{word.toUpperCase()}{best ? ` / ${best.word.toUpperCase()}` : ' / best available'}</span></summary>
      <table>
        <caption>Expected value before this guess</caption>
        <thead><tr><td /><th scope="col">Your guess<br /><strong>{word.toUpperCase()}</strong></th><th scope="col">{best ? 'More informative' : 'Best available'}<br /><strong>{best?.word.toUpperCase() ?? word.toUpperCase()}</strong></th></tr></thead>
        <tbody>
          <tr><th scope="row">Information</th><td>{decimal(value.bits)} bits</td><td>{decimal(best?.bits ?? value.bits)} bits</td></tr>
          <tr><th scope="row">Average words left</th><td>{decimal(value.expectedRemaining)}</td><td>{decimal(best?.expectedRemaining ?? value.expectedRemaining)}</td></tr>
          <tr><th scope="row">Chance of solving</th><td>{chance(value.solveChance)}</td><td>{chance(best?.solveChance ?? value.solveChance)}</td></tr>
        </tbody>
      </table>
      {alternatives.length > 1 && <p>Other more informative choices: {alternatives.slice(1).map(({ word, bits }) => `${word.toUpperCase()} (${decimal(bits)} bits)`).join(', ')}.</p>}
      <p>Information measures how well a guess separates the possibilities. It does not always pick the quickest way to win.</p>
    </details>}
  </>;
}

export function AnalysisDialog({ round, data, onClose, retained = false }: { round: Round; data: WordData; onClose: () => void; retained?: boolean }) {
  const [analysis, setAnalysis] = useState<WordAnalysis | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setAnalysis(null);
    setFailed(false);
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WordAnalysis | null>) => setAnalysis(event.data);
    worker.onerror = () => setFailed(true);
    worker.postMessage({ round, words: data });
    return () => worker.terminate();
  }, [round, data]);
  const [selected, setSelected] = useState(0);
  const reviewRef = useRef<HTMLElement>(null);
  const guesses = analysis?.kind === 'information' ? analysis.guesses : [];
  const current = guesses[selected];
  const chooseGuess = (index: number) => {
    setSelected(index);
    requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ block: 'nearest' }));
  };
  return <Dialog title="Your guesses." titleId="analysis-title" onClose={onClose}>
    <div className="analysis">
      {!analysis && <p role="status">{failed ? 'Analysis could not be loaded. Close and reopen to try again.' : 'Comparing your guesses with the word list…'}</p>}
      <p className="review-result"><strong>{round.answer.toUpperCase()}</strong><span>{round.status === 'won' ? 'Solved' : 'Not solved'} · {round.guesses.length} {round.guesses.length === 1 ? 'attempt' : 'attempts'}</span></p>
      {analysis?.kind === 'clue' ? <section className="review-clue">
        <p className="eyebrow">THE GIVEN CLUE</p>
        <FeedbackWord guess={round.clue!} />
        <h3>One clue, one possible answer.</h3>
        <p>Only <strong>{analysis.answer.toUpperCase()}</strong> fits every mark on <strong>{analysis.word.toUpperCase()}</strong> in the accepted word list. The clue already supplied all the information needed to identify it.</p>
        <ol>{analysis.explanations.map(({ word, reason }, index) => <li key={index}>
          <FeedbackWord guess={round.guesses[index]} /><p><strong>{word.toUpperCase()}</strong> · {reason}</p>
        </li>)}</ol>
      </section> : analysis?.kind === 'information' && <>
        {guesses.length === 0 ? <p>No scored or consumed guesses to analyse. Unsubmitted entries and free rejections supply no letter information.</p> : <>
          <div className="review-board-heading" aria-hidden="true"><span>Your route to the answer</span><span>Info /100</span><span>Words left</span></div>
          <ol className="review-board" aria-label="Guess analysis">
            {guesses.map((guess, index) => <li key={index}>
              <button type="button" aria-label={`Review guess ${index + 1}: ${guess.word.toUpperCase()}`}
                aria-describedby={`review-information-${index} review-left-${index}`}
                aria-current={selected === index ? 'step' : undefined} onClick={() => chooseGuess(index)}>
                <span className="review-board-word"><span className="review-step">{index + 1}</span><FeedbackWord guess={round.guesses[index]} /></span>
                <span id={`review-information-${index}`} className="review-score" aria-label={`Information score: ${informationScore(guess) ?? 'not applicable'}`}>{informationScore(guess) ?? '—'}</span>
                <span id={`review-left-${index}`} className="review-left" aria-label={`${guess.after} possible answers left`}>{guess.after}</span>
              </button>
            </li>)}
          </ol>
          <section ref={reviewRef} className="review-turn" aria-label={`Guess ${selected + 1} review`}>
            <p className="eyebrow" aria-live="polite">GUESS {selected + 1} OF {guesses.length} · {current.word.toUpperCase()} · {current.before} → {current.after} POSSIBLE</p>
            <GuessReview key={selected} guess={current} answers={data.answers[round.length]} solved={round.guesses[selected].feedback?.every((mark) => mark === 'correct') ?? false} />
          </section>
        </>}
        <details className="analysis-method">
          <summary>About the analysis</summary>
          <p><strong>Info /100</strong> compares expected information with the most informative legal guess: 100 means a top information choice. It is not an overall skill or luck rating. A dash means the attempt was unscored or only one answer remained.</p>
          <p><strong>Bits</strong> measure expected information gain across all possible feedback patterns. One bit halves uncertainty on average. Average words left and solve chance describe the choice before its feedback was known; words left describes the actual result. A solved answer still counts as one.</p>
          <p>All remaining words in Tizzy’s curated answer list are weighted equally. Comparisons use every accepted guess{round.rules.firstLetter ? ' with the supplied first letter' : ' of this length'}. Earlier words, the daily schedule and the no-repeat selection rule are not used in this model.</p>
        </details>
        {current && <nav className="review-pagination" aria-label="Review navigation">
          <button type="button" className="secondary" disabled={selected === 0} onClick={() => chooseGuess(selected - 1)}>← Previous</button>
          <span>{selected + 1} / {guesses.length}</span>
          <button type="button" className="secondary" disabled={selected === guesses.length - 1} onClick={() => chooseGuess(selected + 1)}>Next guess →</button>
        </nav>}
      </>}
      <p className="analysis-footnote">{retained ? 'Saved with your daily result in this browser.' : 'Available until you continue to the next word.'}</p>
    </div>
  </Dialog>;
}
