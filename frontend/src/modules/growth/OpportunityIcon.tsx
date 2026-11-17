/* Module 3: opportunity icons, same look as badges (IconCircle). Coloured by the opportunity's tier with the same
   tokens as TierBadge (Familiar = enablement, Proficient = growth, Demonstrated = pro, Verified = impact), grey with a
   lock while locked. Glyphs are keyed by catalog id (data/catalog.json); a new opportunity falls back to a star. */
import type { ReactNode } from "react";
import { IconCircle, STAR, type Tone } from "./BadgeIcon";

const TIER: Record<string, Tone> = {
  Familiar: { bg: "bg-enablement-bg", fg: "text-enablement", ring: "ring-enablement/30" },
  Proficient: { bg: "bg-growth-bg", fg: "text-growth", ring: "ring-growth/30" },
  Demonstrated: { bg: "bg-pro-bg", fg: "text-pro", ring: "ring-pro/30" },
  Verified: { bg: "bg-impact-bg", fg: "text-impact", ring: "ring-impact/30" },
};

const GLYPH: Record<string, ReactNode> = {
  // Peer study group: three people
  "study-group": <>
    <circle cx="12" cy="8" r="2.6" /><path d="M7.5 19c0-2.8 2-4.6 4.5-4.6s4.5 1.8 4.5 4.6" />
    <circle cx="5.5" cy="10" r="2" /><path d="M2.5 18.5c0-2 1.3-3.4 3-3.6" />
    <circle cx="18.5" cy="10" r="2" /><path d="M21.5 18.5c0-2-1.3-3.4-3-3.6" />
  </>,
  // Peer Reviewer role: clipboard with a tick
  "peer-reviewer": <>
    <rect x="5" y="4.5" width="14" height="16" rx="2" /><path d="M9 4.5V3.5h6v1" />
    <path d="m9 13 2.2 2.2 4-4.2" />
  </>,
  // Mentor match: two speech bubbles
  "mentor-match": <>
    <path d="M3.5 6.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8l-3 2.5v-2.6a2 2 0 0 1-1.5-1.9v-4Z" />
    <path d="M14.5 9.5h4a2 2 0 0 1 2 2v4a2 2 0 0 1-1.5 1.9V20l-3-2.5h-3.5a2 2 0 0 1-2-2" />
  </>,
  // Recruiter visibility: an eye
  "recruiter-visibility": <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" />
  </>,
  // Partner brief: a briefcase
  "partner-brief": <>
    <rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2" />
    <path d="M3.5 12.5h17" />
  </>,
  // IEEE nomination: an award ribbon
  "ieee-nomination": <>
    <circle cx="12" cy="9" r="5" /><path d="m8.8 13 -1.8 7.5 5-2.5 5 2.5-1.8-7.5" />
  </>,
  // IEEE certificate: a certificate with a seal
  "ieee-certificate": <>
    <rect x="3" y="4.5" width="18" height="12.5" rx="1.5" /><path d="M6.5 8.5h7M6.5 11.5h5" />
    <circle cx="16.5" cy="12.5" r="2.2" /><path d="m15.3 14.5-.8 5 2-1.2 2 1.2-.8-5" />
  </>,
};

export function OpportunityIcon({ id, tier, unlocked, size = 50 }: { id: string; tier: string; unlocked: boolean; size?: number }) {
  return <IconCircle tone={TIER[tier] ?? TIER.Familiar} earned={unlocked} size={size}>{GLYPH[id] ?? STAR}</IconCircle>;
}
