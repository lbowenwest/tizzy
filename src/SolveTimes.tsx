import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Distribution } from './history';

type TimeDistribution = Extract<Distribution, { by: 'time' }>;
type Theme = { accent: string; ink: string; muted: string; line: string; paper: string; family: string; font: string };
type Build = (theme: Theme, width: number) => { options: Omit<uPlot.Options, 'width' | 'height'>; data: uPlot.AlignedData };

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const withAlpha = (hex: string, alpha: number) => /^#[0-9a-f]{6}$/i.test(hex)
  ? `rgba(${[1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(',')},${alpha})` : hex;
const quiet = { legend: { show: false }, cursor: { show: false }, select: { show: false, left: 0, top: 0, width: 0, height: 0 } } as const;
const pixelRatio = () => (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);

/** A log-time span covering the values (seconds), at least a factor of four wide. */
function timeSpan(seconds: number[]): [number, number] {
  let [low, high] = [Math.max(1, Math.min(...seconds) * 0.8), Math.max(...seconds) * 1.25];
  if (high / low < 4) {
    const centre = Math.sqrt(low * high);
    [low, high] = [Math.max(1, centre / 2), centre * 2];
  }
  return [low, high];
}

/** Round clock times inside the span, keeping only those at least `gap` pixels apart along an axis `length` long. */
function clockTicks([low, high]: [number, number], length: number, gap: number): number[] {
  const at = (seconds: number) => Math.log(seconds / low) / Math.log(high / low) * length;
  const ticks: number[] = [];
  for (const seconds of [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1200, 1800, 3600]) {
    if (seconds >= low && seconds <= high && (ticks.length === 0 || at(seconds) - at(ticks.at(-1)!) >= gap)) ticks.push(seconds);
  }
  return ticks;
}

function axis(theme: Theme, changes: uPlot.Axis): uPlot.Axis {
  // filter: uPlot's log axes otherwise blank every label that is not a power of the log base.
  return { stroke: theme.muted, font: theme.font, grid: { show: false }, ticks: { show: false }, gap: 4, filter: (_, splits) => splits, ...changes };
}

/** The element's content width, so charts draw at one unit per pixel and their text stays a fixed size. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A uPlot chart in the page theme; uPlot loads only when a chart is first shown. */
function Chart({ height, build }: { height: number; build: Build }) {
  const [ref, width] = useWidth();
  useEffect(() => {
    const element = ref.current;
    if (!element || width === 0) return;
    let plot: uPlot | undefined;
    let cancelled = false;
    void import('uplot').then(({ default: UPlot }) => {
      if (cancelled) return;
      const style = getComputedStyle(element);
      const colour = (name: string) => style.getPropertyValue(name).trim();
      const theme = { accent: colour('--accent'), ink: colour('--ink'), muted: colour('--muted'), line: colour('--line'), paper: colour('--paper'), family: style.fontFamily, font: `10px ${style.fontFamily}` };
      const { options, data } = build(theme, width);
      plot = new UPlot({ ...options, width, height }, data, element);
    });
    return () => { cancelled = true; plot?.destroy(); };
  }, [width, height, build]);
  return <div ref={ref} className="solve-chart" style={{ height }} />;
}

/** Recent words oldest to newest on a log-time scale: solves joined by a line, failures as crosses, the latest emphasised. */
function trend(recent: TimeDistribution['recent'], averageMs: number | null): Build {
  return (theme) => {
    const count = recent.length;
    const seconds = recent.map(({ durationMs }) => durationMs / 1000);
    const span = timeSpan([...seconds, ...(averageMs === null ? [] : [averageMs / 1000])]);
    const cross = (u: uPlot, x: number, y: number, size: number, colour: string, width: number) => {
      const ctx = u.ctx;
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
      ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
      ctx.stroke();
      ctx.restore();
    };
    return {
      options: {
        ...quiet,
        padding: [8, 12, 0, 0],
        scales: { x: { time: false, range: [0.5, count + 0.5] }, y: { distr: 3, log: 2, range: span } },
        axes: [
          axis(theme, { size: 22, splits: () => count > 1 ? [1, count] : [1], values: (_, splits) => splits.map((value) => value === count ? 'latest' : 'older') }),
          axis(theme, {
            size: 40, grid: { show: true, stroke: theme.line, width: 1 },
            splits: (u) => clockTicks(span, u.bbox.height / pixelRatio(), 20), values: (_, splits) => splits.map((value) => formatDuration(value * 1000)),
          }),
        ],
        series: [
          {},
          { stroke: theme.accent, width: 2, spanGaps: true, points: { show: true, size: 6, fill: theme.accent, stroke: theme.accent } },
          { stroke: theme.muted, width: 1, dash: [4, 3], points: { show: false } },
        ],
        hooks: {
          draw: [(u) => {
            const ratio = pixelRatio();
            recent.forEach(({ solved }, index) => {
              const [x, y] = [u.valToPos(index + 1, 'x', true), u.valToPos(seconds[index], 'y', true)];
              const latest = index === count - 1;
              if (!solved) cross(u, x, y, (latest ? 5 : 4) * ratio, latest ? theme.ink : theme.muted, (latest ? 2.5 : 2) * ratio);
              else if (latest) {
                u.ctx.save();
                u.ctx.beginPath();
                u.ctx.arc(x, y, 5.5 * ratio, 0, 2 * Math.PI);
                u.ctx.fillStyle = theme.accent;
                u.ctx.strokeStyle = theme.paper;
                u.ctx.lineWidth = 2 * ratio;
                u.ctx.fill();
                u.ctx.stroke();
                u.ctx.restore();
              }
            });
          }],
        },
      },
      data: [
        recent.map((_, index) => index + 1),
        recent.map(({ solved }, index) => solved ? seconds[index] : null),
        recent.map(() => averageMs === null ? null : averageMs / 1000),
      ],
    };
  };
}

/**
 * The fitted log-normal as a bell over log time, its middle (one standard deviation either side: about two-thirds of
 * solves) shaded, and each solve placed on the curve at its time so you can see where it sits. The latest is labelled.
 */
function spread(solves: number[], fit: NonNullable<TimeDistribution['fit']>, latestSolved: boolean): Build {
  return (theme) => {
    const span = timeSpan([...solves.map((ms) => ms / 1000), Math.exp(fit.mu - 2.2 * fit.sigma), Math.exp(fit.mu + 2.2 * fit.sigma)]);
    const bell = (seconds: number) => Math.exp(-((Math.log(seconds) - fit.mu) ** 2) / (2 * fit.sigma ** 2));
    const [inner, outer] = [Math.exp(fit.mu - fit.sigma), Math.exp(fit.mu + fit.sigma)];
    const samples = [...Array.from({ length: 121 }, (_, step) => span[0] * (span[1] / span[0]) ** (step / 120)), inner, outer].sort((a, b) => a - b);
    return {
      options: {
        ...quiet,
        padding: [22, 12, 0, 12],
        scales: { x: { time: false, distr: 3, log: 2, range: span }, y: { range: [0, 1] } },
        axes: [
          axis(theme, {
            size: 24, ticks: { show: true, stroke: theme.line, width: 1, size: 4 },
            splits: (u) => clockTicks(span, u.bbox.width / pixelRatio(), 48), values: (_, splits) => splits.map((value) => formatDuration(value * 1000)),
          }),
          { show: false },
        ],
        series: [
          {},
          { stroke: theme.accent, width: 2, fill: withAlpha(theme.accent, 0.08), points: { show: false } },
          { stroke: 'transparent', width: 0, fill: withAlpha(theme.accent, 0.26), points: { show: false } },
        ],
        hooks: {
          draw: [(u) => {
            const ratio = pixelRatio();
            const ctx = u.ctx;
            const at = (seconds: number) => [u.valToPos(seconds, 'x', true), u.valToPos(bell(seconds), 'y', true)];
            ctx.save();
            const base = u.valToPos(0, 'y', true);
            ctx.strokeStyle = theme.line;
            ctx.lineWidth = ratio;
            ctx.beginPath();
            ctx.moveTo(u.bbox.left, base);
            ctx.lineTo(u.bbox.left + u.bbox.width, base);
            ctx.stroke();
            const dot = (x: number, y: number, radius: number, fill: string) => {
              ctx.beginPath();
              ctx.arc(x, y, radius * ratio, 0, 2 * Math.PI);
              ctx.fillStyle = fill;
              ctx.fill();
              ctx.strokeStyle = theme.paper;
              ctx.lineWidth = 1.5 * ratio;
              ctx.stroke();
            };
            const earlier = latestSolved ? solves.slice(0, -1) : solves;
            for (const ms of earlier) {
              const [x, y] = at(ms / 1000);
              dot(x, y, 3.5, withAlpha(theme.ink, 0.6));
            }
            if (latestSolved) {
              const ms = solves.at(-1)!;
              const [x, y] = at(ms / 1000);
              dot(x, y, 5.5, theme.accent);
              // Label outside the slope: left of a dot on the rising side, right of one on the falling side.
              const rising = Math.log(ms / 1000) < fit.mu;
              const text = `latest ${formatDuration(ms)}`;
              ctx.font = `600 ${10 * ratio}px ${theme.family}`;
              ctx.textAlign = rising ? 'right' : 'left';
              ctx.textBaseline = 'middle';
              const [labelX, labelY] = [x + (rising ? -9 : 9) * ratio, y - 6 * ratio];
              ctx.lineJoin = 'round';
              ctx.lineWidth = 3 * ratio;
              ctx.strokeStyle = theme.paper;
              ctx.strokeText(text, labelX, labelY);
              ctx.fillStyle = theme.ink;
              ctx.fillText(text, labelX, labelY);
            }
            ctx.restore();
          }],
        },
      },
      data: [
        samples,
        samples.map(bell),
        samples.map((seconds) => seconds >= inner && seconds <= outer ? bell(seconds) : null),
      ],
    };
  };
}

export function SolveTimes({ distribution, averageMs }: { distribution: TimeDistribution; averageMs: number | null }) {
  const { recent, solves, fit } = distribution;
  const latest = recent.at(-1);
  const label = `Last ${recent.length} ${recent.length === 1 ? 'word' : 'words'}, oldest first: `
    + recent.map(({ durationMs, solved }) => solved ? formatDuration(durationMs) : `not solved (${formatDuration(durationMs)})`).join(', ');
  // About 68% of a normal distribution lies within one standard deviation of its mean.
  const middle = fit && `${formatDuration(Math.exp(fit.mu - fit.sigma) * 1000)}–${formatDuration(Math.exp(fit.mu + fit.sigma) * 1000)}`;
  return <>
    <h3>Solve times</h3>
    <figure className="solve-figure">
      <div role="img" aria-label={label}><Chart height={140} build={trend(recent, averageMs)} /></div>
      <figcaption aria-hidden="true">{averageMs !== null && <><span className="legend-average" /> average · </>}✕ not solved</figcaption>
    </figure>
    <h3>Your spread</h3>
    {fit ? <figure className="solve-figure">
      <div aria-hidden="true"><Chart height={150} build={spread(solves, fit, latest?.solved === true)} /></div>
      <figcaption>About two-thirds of your solves take {middle} (shaded).</figcaption>
    </figure> : <p className="stats-note">Solve at least two words to see your spread.</p>}
  </>;
}
