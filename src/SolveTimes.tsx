import { useLayoutEffect, useRef, useState } from 'react';
import type { Distribution } from './history';

type TimeDistribution = Extract<Distribution, { by: 'time' }>;

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const tickSeconds = [5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600];
const tickLabel = (seconds: number) => seconds < 60 ? `${seconds}s` : `${seconds / 60}m`;

/** A log-time axis covering the values, at least a factor of four wide, with up to four round-number ticks. */
function timeScale(values: number[]) {
  let [low, high] = [Math.max(1, Math.min(...values) / 1000 * 0.8), Math.max(...values) / 1000 * 1.25];
  if (high / low < 4) {
    const centre = Math.sqrt(low * high);
    [low, high] = [Math.max(1, centre / 2), centre * 2];
  }
  const inside = tickSeconds.filter((seconds) => seconds >= low && seconds <= high);
  const ticks = inside.length <= 4 ? inside : inside.filter((_, index) => index % Math.ceil(inside.length / 4) === 0);
  return { ticks, at: (seconds: number) => (Math.log(seconds) - Math.log(low)) / (Math.log(high) - Math.log(low)), low, high };
}

/** Recent words oldest to newest on a log-time scale: solves joined by a line, failures as crosses, the latest emphasised. */
function Trend({ width, recent, averageMs }: { width: number; recent: TimeDistribution['recent']; averageMs: number | null }) {
  const height = 140;
  const [left, right, top, bottom] = [34, 10, 8, 18];
  const scale = timeScale([...recent.map(({ durationMs }) => durationMs), ...(averageMs === null ? [] : [averageMs])]);
  const x = (index: number) => recent.length === 1 ? (left + width - right) / 2 : left + index / (recent.length - 1) * (width - left - right);
  const y = (ms: number) => top + (1 - scale.at(ms / 1000)) * (height - top - bottom);
  const solved = recent.map((word, index) => ({ ...word, index })).filter(({ solved }) => solved);
  const label = `Last ${recent.length} ${recent.length === 1 ? 'word' : 'words'}, oldest first: `
    + recent.map(({ durationMs, solved }) => solved ? formatDuration(durationMs) : `not solved (${formatDuration(durationMs)})`).join(', ');
  return (
    <svg className="solve-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {scale.ticks.map((seconds) => <g key={seconds}>
        <line className="chart-grid" x1={left} x2={width - right} y1={y(seconds * 1000)} y2={y(seconds * 1000)} />
        <text className="chart-label" x={left - 6} y={y(seconds * 1000)} dy="0.32em" textAnchor="end">{tickLabel(seconds)}</text>
      </g>)}
      {averageMs !== null && <line className="chart-average" x1={left} x2={width - right} y1={y(averageMs)} y2={y(averageMs)} />}
      {solved.length > 1 && <polyline className="chart-line" points={solved.map(({ index, durationMs }) => `${x(index)},${y(durationMs)}`).join(' ')} />}
      {recent.map(({ durationMs, solved: isSolved }, index) => {
        const latest = index === recent.length - 1;
        const [cx, cy] = [x(index), y(durationMs)];
        return isSolved ? <circle key={index} className={latest ? 'chart-point chart-latest' : 'chart-point'} cx={cx} cy={cy} r={latest ? 5 : 3} />
          : <path key={index} className={latest ? 'chart-failed chart-latest' : 'chart-failed'} d={`M${cx - 4},${cy - 4}l8,8m0,-8l-8,8`} />;
      })}
      <text className="chart-label" x={left} y={height - 4}>older</text>
      <text className="chart-label" x={width - right} y={height - 4} textAnchor="end">latest</text>
    </svg>
  );
}

/** A log-normal bell fitted to every solve, with the solves themselves as dots along the base. */
function Spread({ width, solves, fit, latestMs }: { width: number; solves: number[]; fit: NonNullable<TimeDistribution['fit']>; latestMs: number | null }) {
  const height = 110;
  const [side, top, bottom] = [10, 8, 30];
  const tails = [fit.mu - 2.5 * fit.sigma, fit.mu + 2.5 * fit.sigma].map((value) => Math.exp(value) * 1000);
  const scale = timeScale([...solves, ...tails]);
  const x = (seconds: number) => side + scale.at(seconds) * (width - 2 * side);
  const base = height - bottom;
  const steps = 60;
  const curve = Array.from({ length: steps + 1 }, (_, step) => {
    const seconds = scale.low * (scale.high / scale.low) ** (step / steps);
    const density = Math.exp(-((Math.log(seconds) - fit.mu) ** 2) / (2 * fit.sigma ** 2));
    return `${x(seconds)},${base - density * (base - top)}`;
  });
  return (
    <svg className="solve-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polygon className="chart-curve" points={[`${x(scale.low)},${base}`, ...curve, `${x(scale.high)},${base}`].join(' ')} />
      <line className="chart-grid" x1={side} x2={width - side} y1={base} y2={base} />
      {solves.map((ms, index) => <circle key={index} className="chart-rug" cx={x(ms / 1000)} cy={base + 7} r={3} />)}
      {latestMs !== null && <circle className="chart-point chart-latest" cx={x(latestMs / 1000)} cy={base + 7} r={5} />}
      {scale.ticks.map((seconds) => <text key={seconds} className="chart-label" x={x(seconds)} y={height - 4} textAnchor="middle">{tickLabel(seconds)}</text>)}
    </svg>
  );
}

/** The element's content width, so charts draw at one unit per pixel and their text stays a fixed size. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function SolveTimes({ distribution, averageMs }: { distribution: TimeDistribution; averageMs: number | null }) {
  const { recent, solves, fit } = distribution;
  const [ref, width] = useWidth();
  const latest = recent.at(-1);
  // About 68% of a normal distribution lies within one standard deviation of its mean.
  const spread = fit && `About two-thirds of your solves take ${formatDuration(Math.exp(fit.mu - fit.sigma) * 1000)}–${formatDuration(Math.exp(fit.mu + fit.sigma) * 1000)}.`;
  return <div ref={ref}>
    <h3>Solve times</h3>
    <figure className="solve-figure">
      <Trend width={width} recent={recent} averageMs={averageMs} />
      <figcaption aria-hidden="true">{averageMs !== null && <><span className="legend-average" /> average · </>}✕ not solved</figcaption>
    </figure>
    <h3>Your spread</h3>
    {spread ? <figure className="solve-figure">
      <Spread width={width} solves={solves} fit={fit} latestMs={latest?.solved ? latest.durationMs : null} />
      <figcaption>{spread}</figcaption>
    </figure> : <p className="stats-note">Solve at least two words to see your spread.</p>}
  </div>;
}
