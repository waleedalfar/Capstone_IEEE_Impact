/* Module 4: Buddies > Connections (D-54). Find people, answer requests, see your connections and requests you sent.
   Everyone links to their public profile. */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Button, Empty, ErrorNote, Field, Input, Panel, PanelTitle, Skeleton } from "@/components/ui";
import { ApiError, get, post } from "@/lib/api";
import { ago } from "@/lib/format";
import type { ConnectionItem, Connections } from "@/lib/types";
import { Avatar, ConnectButton, usePeopleSearch } from "./people";

function PersonRow({ handle, name, sub, right }: { handle?: string | null; name: string; sub?: string; right?: ReactNode }) {
  const body = (
    <>
      <Avatar name={name} />
      <span className="min-w-0 flex-1">
        <strong className="block truncate font-semibold text-black">{name}</strong>
        {sub && <span className="block truncate text-sm text-secondary">{sub}</span>}
      </span>
    </>
  );
  return (
    <li className="flex items-center gap-4 border-b border-black px-2.5 py-3">
      {handle ? <Link to={`/people/${handle}`} className="flex min-w-0 flex-1 items-center gap-4 hover:opacity-80">{body}</Link> : <span className="flex min-w-0 flex-1 items-center gap-4">{body}</span>}
      {right && <span className="flex shrink-0 items-center gap-2">{right}</span>}
    </li>
  );
}

export function ConnectionsTab({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  useEffect(() => setQ(initialQuery), [initialQuery]);
  const people = usePeopleSearch(q);
  const [data, setData] = useState<Connections | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => get<Connections>("/api/v1/connections").then(setData).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load connections."));
  useEffect(() => { void load(); }, []);

  const act = async (c: ConnectionItem, action: "accept" | "decline" | "remove") => {
    setError(null);
    try { await post(`/api/v1/connections/${c.id}/${action}`); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : "That didn't work."); }
  };
  const name = (c: ConnectionItem) => c.person?.displayName || c.person?.handle || "Someone";
  const handle = (c: ConnectionItem) => c.person?.handle ? `@${c.person.handle}` : "";

  return (
    <div className="flex flex-col gap-6">
      {error && <ErrorNote>{error}</ErrorNote>}
      <Panel>
        <PanelTitle>Find people</PanelTitle>
        <Field label="Search by name or handle" hint="Open someone's profile to see their Impact Score, tiers and badges.">
          <Input value={q} placeholder="Name or @handle" onChange={(e) => setQ(e.target.value)} autoFocus={!!initialQuery} />
        </Field>
        {q.trim().replace(/^@/, "").length >= 2 && (
          people === null ? <Skeleton className="mt-3 h-14 w-full" />
            : people.length === 0 ? <Empty>No one matches "{q.trim()}".</Empty>
            : <ul className="mt-2">{people.map((p) => (
              <PersonRow key={p.handle} handle={p.handle} name={p.displayName}
                sub={[`@${p.handle}`, p.headline || p.targetCareer].filter(Boolean).join(" · ")}
                right={<ConnectButton handle={p.handle} state={p.connection} onChange={() => void load()} />} />
            ))}</ul>
        )}
      </Panel>

      {data && data.received.length > 0 && (
        <Panel>
          <PanelTitle count={data.received.length}>Requests</PanelTitle>
          <ul>{data.received.map((c) => (
            <PersonRow key={c.id} handle={c.person?.handle} name={name(c)} sub={`${handle(c)} · asked ${ago(c.createdAt)}`}
              right={<><Button className="text-xs" onClick={() => act(c, "accept")}>Accept</Button><Button kind="secondary" className="text-xs" onClick={() => act(c, "decline")}>Decline</Button></>} />
          ))}</ul>
        </Panel>
      )}

      <Panel>
        <PanelTitle count={data?.connections.length ?? 0}>Your connections</PanelTitle>
        {!data ? <Skeleton className="h-14 w-full" /> : data.connections.length === 0 ? <Empty>No connections yet. Find someone above and connect.</Empty> : (
          <ul>{data.connections.map((c) => (
            <PersonRow key={c.id} handle={c.person?.handle} name={name(c)} sub={`${handle(c)} · connected ${ago(c.respondedAt ?? c.createdAt)}`}
              right={<Button kind="text" className="text-xs" onClick={() => act(c, "remove")}>Remove</Button>} />
          ))}</ul>
        )}
      </Panel>

      {data && data.sent.length > 0 && (
        <Panel>
          <PanelTitle count={data.sent.length}>Requests you sent</PanelTitle>
          <ul>{data.sent.map((c) => (
            <PersonRow key={c.id} handle={c.person?.handle} name={name(c)} sub={`${handle(c)} · sent ${ago(c.createdAt)}`}
              right={<Button kind="text" className="text-xs" onClick={() => act(c, "remove")}>Withdraw</Button>} />
          ))}</ul>
        </Panel>
      )}
    </div>
  );
}
