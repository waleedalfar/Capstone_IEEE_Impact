/* Module 3: badge icons. A tinted circle with a line icon, like CategoryIcon, coloured by rarity from tokens.css only:
   Common = growth (teal), Uncommon = enablement (blue), Rare = impact (orange). Unearned badges are grey with a lock. */
import type { ReactNode } from "react";

const RARITY: Record<string, Tone> = {
  Common: { bg: "bg-growth-bg", fg: "text-growth", ring: "ring-growth/30" },
  Uncommon: { bg: "bg-enablement-bg", fg: "text-enablement", ring: "ring-enablement/30" },
  Rare: { bg: "bg-impact-bg", fg: "text-impact", ring: "ring-impact/30" },
};

/** 24×24 line glyphs, drawn with currentColor so the rarity colour (or grey) applies. */
const GLYPH: Record<string, ReactNode> = {
  // First Steps: two footprints
  "first-evidence": <>
    <path d="M8.5 3.5c1.6 0 2.5 1.8 2.5 4s-.9 3.5-2.5 3.5S6 9.7 6 7.5s.9-4 2.5-4Z" />
    <path d="M6.5 13.5h4l-.4 2.2a1.6 1.6 0 0 1-3.2 0l-.4-2.2Z" />
    <path d="M15.5 7.5c1.6 0 2.5 1.8 2.5 4s-.9 3.5-2.5 3.5-2.5-1.3-2.5-3.5.9-4 2.5-4Z" />
    <path d="M13.5 17.5h4l-.4 2.2a1.6 1.6 0 0 1-3.2 0l-.4-2.2Z" />
  </>,
  // Consistent Contributor: a flame
  consistent: <path d="M12 3c.5 3-2.5 4.5-2.5 7.5a2.5 2.5 0 0 0 5 0c0-1 -.4-1.8-.4-1.8S17.5 10 17.5 14a5.5 5.5 0 0 1-11 0C6.5 9 12 7 12 3Z" />,
  // Project Builder: stacked blocks
  builder: <>
    <rect x="4" y="13" width="7" height="7" rx="1.2" />
    <rect x="13" y="13" width="7" height="7" rx="1.2" />
    <rect x="8.5" y="4" width="7" height="7" rx="1.2" />
  </>,
  // Evidence Validated: shield with a tick
  reviewed: <>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 7.8 7 9.5 4.1-1.7 7-5.3 7-9.5V6l-7-3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </>,
};
export const STAR = <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />;

export type Tone = { bg: string; fg: string; ring: string };
const LOCKED: Tone = { bg: "bg-subpanel", fg: "text-border", ring: "ring-border/40" };

/** The shared look: tinted circle, 24×24 line glyph in currentColor, grey with a lock badge when not yet earned. */
export function IconCircle({ tone, earned, size = 44, children }: { tone: Tone; earned: boolean; size?: number; children: ReactNode }) {
  const t = earned ? tone : LOCKED;
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-full ring-2 ${t.bg} ${t.fg} ${t.ring}`}
      style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      {!earned && (
        <span className="absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full bg-white text-secondary shadow-sm">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
      )}
    </span>
  );
}

export function BadgeIcon({ id, rarity, earned, size = 44 }: { id: string; rarity: string; earned: boolean; size?: number }) {
  return <IconCircle tone={RARITY[rarity] ?? RARITY.Common} earned={earned} size={size}>{GLYPH[id] ?? STAR}</IconCircle>;
}
