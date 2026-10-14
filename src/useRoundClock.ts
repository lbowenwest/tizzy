import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { advanceClock, isRoundClockPaused, type Round } from './game';

/** Observe wall time; the pure controller alone decides whether a deadline ends play. */
export function useRoundClock(round: Round, setRound: Dispatch<SetStateAction<Round>>): number {
  const [now, setNow] = useState(Date.now);
  const running = round.status !== 'expired' && !isRoundClockPaused(round)
    && (round.roundDeadline !== null || (round.status === 'playing' && round.wordDeadline !== null));
  useEffect(() => {
    if (!running) return;
    function observe() {
      const time = Date.now();
      setNow(time);
      // Always inspect the latest state. A stale callback cannot expire a replacement word.
      setRound((current) => advanceClock(current, time));
    }
    observe();
    const interval = window.setInterval(observe, 250);
    document.addEventListener('visibilitychange', observe);
    window.addEventListener('pageshow', observe);
    window.addEventListener('focus', observe);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', observe);
      window.removeEventListener('pageshow', observe);
      window.removeEventListener('focus', observe);
    };
  }, [running, round.wordDeadline, round.roundDeadline, setRound]);
  // A resumed deadline is based on current wall time, not the last pre-pause tick.
  return running ? Date.now() : now;
}
