/* Module 3: Impact Score over time, drawn from the points ledger (/api/v1/score-events). Shown on Home and Growth.
   The line is the running total of counted points (validated + effort; provisional points are pending, not counted).
   The effort cap can make that raw total run above the real score, so the series is scaled to end exactly at the
   Impact Score the page shows: the shape is the user's history, the last point is always the true number. */
import { useId, useMemo } from "react";
import { pts } from "@/lib/format";

export type LedgerEvent = { id: string; kind: string; points: number; skillId: string | null; reason: string; createdAt: string };

const COUNTED = new Set(["validated", "effort"]);
const W = 320;
const H = 120;
const PAD = { top: 10, right: 8, bottom: 6, left: 8 };
const WEEK = 7 * 24 * 3600 * 1000;

type Pt = { t: number; v: number };

function series(events: LedgerEvent[], impact: number, now: number): Pt[] {
  const asc = events.filter((e) => COUNTED.has(e.kind)).map((e) => ({ t: new Date(e.createdAt).getTime(), p: e.points })).sort((a, b) => a.t - b.t);
  if (asc.length === 0) return impact > 0 ? [{ t: now - WEEK, v: 0 }, { t: now, v: impact }] : [];
  let run = 0;
  const raw: Pt[] = [{ t: asc[0].t - 1, v: 0 }, ...asc.map((e) => ({ t: e.t, v: (run += e.p) }))];
  const scale = run > 0 ? impact / run : 1;
  return [...raw.map((p) => ({ t: p.t, v: Math.max(0, p.v * scale) })), { t: Math.max(now, raw[raw.length - 1].t), v: impact }];
}

/** Smooth path through the points; horizontal control handles keep a rising line from overshooting. */
function smooth(xy: [number, number][]): string {
  return xy.map(([x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = xy[i - 1];
    const mx = (px + x) / 2;
    return `C${mx},${py} ${mx},${y} ${x},${y}`;
  }).join(" ");
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function ImpactChart({ events, impact, compact = false }: { events: LedgerEvent[] | null; impact: number; compact?: boolean }) {
  const gid = useId().replace(/:/g, "");
  // "now" is taken when the events arrive, so the line ends at the moment the ledger was loaded.
  const { data, thisWeek } = useMemo(() => {
    const now = Date.now();
    return {
      data: events ? series(events, impact, now) : [],
      thisWeek: (events ?? []).filter((e) => COUNTED.has(e.kind) && now - new Date(e.createdAt).getTime() < WEEK).reduce((s, e) => s + e.points, 0),
    };
  }, [events, impact]);

  if (events === null) return <div className={`w-full animate-pulse rounded-lg bg-subpanel ${compact ? "h-[96px]" : "h-[132px]"}`} />;

  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg bg-white px-4 py-5 text-center">
        <svg viewBox="0 0 120 32" className="h-8 w-28" aria-hidden="true">
          <path d="M4 28 C30 28 40 22 60 18 S100 6 116 4" fill="none" stroke="var(--color-growth)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 5" opacity="0.6" />
        </svg>
        <p className="text-xs text-secondary">Your growth line starts with your first scored evidence.</p>
      </div>
    );
  }

  const t0 = data[0].t;
  const t1 = data[data.length - 1].t;
  const vmax = Math.max(...data.map((p) => p.v), 1);
  const x = (t: number) => PAD.left + ((t - t0) / Math.max(t1 - t0, 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / (vmax * 1.08)) * (H - PAD.top - PAD.bottom);
  const xy = data.map((p) => [x(p.t), y(p.v)] as [number, number]);
  const line = smooth(xy);
  const [ex] = xy[xy.length - 1];
  const area = `${line} L${ex},${H} L${xy[0][0]},${H} Z`;

  return (
    <figure className="flex flex-col gap-1.5 rounded-lg bg-white px-3 pb-2 pt-3">
      <figcaption className="flex items-center justify-between px-1 text-xs">
        <span className="font-semibold text-navy">Impact over time</span>
        {thisWeek > 0
          ? <span className="rounded-full bg-growth-bg px-2 py-0.5 font-semibold text-growth">▲ +{pts(thisWeek)} this week</span>
          : <span className="text-secondary">No new points this week</span>}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`w-full ${compact ? "h-[72px]" : "h-[108px]"}`}
        role="img" aria-label={`Impact Score rose from 0 to ${pts(impact)} between ${fmtDate(t0)} and today.`}>
        <defs>
          <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-growth)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-growth)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.33, 0.66].map((f) => <line key={f} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + f * (H - PAD.top - PAD.bottom)} y2={PAD.top + f * (H - PAD.top - PAD.bottom)} stroke="var(--color-border)" strokeOpacity="0.35" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />)}
        <path d={area} fill={`url(#fill-${gid})`} className="impact-chart-area" />
        <path d={line} fill="none" stroke="var(--color-growth)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke" pathLength={1} className="impact-chart-line" />
      </svg>
      {/* The end marker sits outside the stretched SVG so it stays round at any width. */}
      <div className="relative -mt-1.5 flex justify-between px-1 text-[11px] text-secondary">
        <span>{fmtDate(t0)}</span>
        <span className="flex items-center gap-1 font-semibold text-growth"><span className="impact-chart-dot size-2 rounded-full bg-growth" />{pts(impact)} today</span>
      </div>
    </figure>
  );
}
