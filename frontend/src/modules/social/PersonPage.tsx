/* Module 4: someone's public profile (D-54), in Home's two-column layout. Left: who they are, their Impact Score and
   the connect button. Right: skill tiers, badges, unlocked opportunities and featured contributions. Only what the
   server sends for a public profile: no email, evidence or points ledger. */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Divider, Empty, ErrorNote, Panel, PanelTitle, Progress, Skeleton, SubPanel, Tag, TierBadge } from "@/components/ui";
import { ApiError, get } from "@/lib/api";
import { pts } from "@/lib/format";
import type { PublicProfile } from "@/lib/types";
import { BadgeIcon } from "@/modules/growth/BadgeIcon";
import { OpportunityIcon } from "@/modules/growth/OpportunityIcon";
import { Avatar, ConnectButton } from "./people";

export default function PersonPage() {
  const { handle = "" } = useParams();
  const [p, setP] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setError(null);
    get<{ person: PublicProfile }>(`/api/v1/people/${encodeURIComponent(handle)}`).then((r) => setP(r.person))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load this profile."));
  };
  useEffect(() => { setP(null); load(); }, [handle]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="mx-auto max-w-[820px]"><ErrorNote onRetry={load}>{error}</ErrorNote></div>;
  if (!p) return <div className="grid gap-8 lg:grid-cols-[424px_minmax(0,738px)]"><Skeleton className="h-[520px] w-full" /><Skeleton className="h-[520px] w-full" /></div>;

  const g = p.growth;
  const earned = g.badges.filter((b) => b.earned);
  const study = [p.education.major, p.education.institution].filter(Boolean).join(", ");
  return (
    <div className="flex flex-col gap-4">
      <Link to="/buddies?tab=connections" className="text-sm font-semibold text-primary hover:opacity-60">People</Link>
      <div className="grid gap-8 lg:grid-cols-[424px_minmax(0,738px)]">
        <aside className="flex flex-col rounded-xl border border-border bg-panel px-4 pb-8 pt-[31px]">
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar name={p.displayName} size={88} />
            <h1 className="text-xl font-bold tracking-[-0.6px] text-navy">{p.displayName}</h1>
            <span className="text-sm text-secondary">@{p.handle}{p.connections ? ` · ${p.connections} connection${p.connections === 1 ? "" : "s"}` : ""}</span>
            {p.headline && <p className="text-[15px] text-text">{p.headline}</p>}
            {(p.position || study) && <p className="text-xs text-secondary">{[p.position, study].filter(Boolean).join(" · ")}{p.education.gradYear ? ` '${String(p.education.gradYear).slice(2)}` : ""}</p>}
            {p.connection === "self"
              ? <Link to="/profile" className="mt-2 text-sm font-semibold text-primary hover:opacity-60">This is you. Edit your profile</Link>
              : <ConnectButton className="mt-2" handle={p.handle} state={p.connection} onChange={() => load()} />}
          </div>
          <Divider />
          <div className="text-center">
            <strong className="block text-[32px] font-bold leading-[1.5] tracking-[-0.96px] text-primary">{pts(g.impact)}</strong>
            <span className="block text-xs tracking-[-0.36px] text-text">Impact Score</span>
            <span className="mt-1 flex flex-wrap items-center justify-center gap-1 text-xs text-text">
              {p.targetCareer ? `${p.targetCareer} · ` : ""}<TierBadge tier={g.roleTier} />
            </span>
          </div>
          {p.bio && <><Divider /><SubPanel><h2 className="mb-2 text-base font-bold text-primary">About</h2><p className="whitespace-pre-wrap text-sm text-text">{p.bio}</p></SubPanel></>}
          {(p.skills.length > 0 || p.interests.length > 0) && (
            <SubPanel className="mt-4">
              {p.skills.length > 0 && <><h2 className="mb-2 text-base font-bold text-primary">Skills</h2><div className="mb-3 flex flex-wrap gap-1.5">{p.skills.map((s) => <Tag key={s}>{s}</Tag>)}</div></>}
              {p.interests.length > 0 && <><h2 className="mb-2 text-base font-bold text-primary">Interests</h2><div className="flex flex-wrap gap-1.5">{p.interests.map((s) => <Tag key={s} tone="pro">{s}</Tag>)}</div></>}
            </SubPanel>
          )}
        </aside>

        <section className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelTitle count={g.skills.length}>Skill tiers</PanelTitle>
            {g.skills.length === 0 ? <Empty>No tracked skills yet.</Empty> : (
              <ul className="flex flex-col">
                {g.skills.map((s) => (
                  <li key={s.skillId} className="flex flex-col gap-2 border-b border-black px-2.5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="font-semibold text-black">{s.name}</strong>{s.core && <Tag>core</Tag>}<TierBadge tier={s.tier} />
                      <span className="ml-auto text-sm font-semibold text-time">{pts(s.points)} pts</span>
                    </div>
                    {s.nextTier && <Progress value={s.progress} label={`${s.name} progress to ${s.nextTier}`} />}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            <PanelTitle count={earned.length}>Badges</PanelTitle>
            {earned.length === 0 ? <Empty>No badges earned yet.</Empty> : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">{earned.map((b) => (
                <li key={b.id} className="flex flex-col items-center gap-2 rounded-lg bg-white px-3 pb-3 pt-4 text-center text-sm" title={b.description}>
                  <BadgeIcon id={b.id} rarity={b.rarity} earned />
                  <strong className="block leading-tight text-navy">{b.name}</strong><span className="text-xs text-secondary">{b.rarity}</span>
                </li>
              ))}</ul>
            )}
          </Panel>
          <Panel>
            <PanelTitle count={g.unlocks.length}>Unlocked opportunities</PanelTitle>
            {g.unlocks.length === 0 ? <Empty>Nothing unlocked yet.</Empty> : (
              <ul className="flex flex-col">{g.unlocks.map((u) => (
                <li key={u.opportunityId} className="flex items-center gap-4 border-b border-black px-2.5 py-3">
                  <OpportunityIcon id={u.opportunityId} tier={u.tier} unlocked />
                  <span className="min-w-0 flex-1"><strong className="block font-semibold text-black">{u.title}</strong><span className="block text-secondary">{u.description}</span></span>
                  <TierBadge tier={u.tier} />
                </li>
              ))}</ul>
            )}
          </Panel>
          {p.contributions.length > 0 && (
            <Panel>
              <PanelTitle count={p.contributions.length}>Featured work</PanelTitle>
              <ul className="flex flex-col gap-3">{p.contributions.map((c, i) => (
                <li key={i} className="rounded-lg bg-white p-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <strong className="font-semibold text-black">{c.title}</strong><Tag>{c.type}</Tag>
                    {c.verified && <Tag tone="growth">verified</Tag>}
                  </div>
                  {c.description && <p className="text-sm text-secondary">{c.description}</p>}
                </li>
              ))}</ul>
            </Panel>
          )}
        </section>
      </div>
    </div>
  );
}
