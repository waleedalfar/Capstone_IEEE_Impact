/* Module 4: shared pieces of the people directory (D-54): search-as-you-type, an initials avatar, and the connect
   button whose label follows the connection state. */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { ApiError, get, post } from "@/lib/api";
import { useConfig } from "@/lib/config";
import type { ConnectionState, PersonResult } from "@/lib/types";

export function useDirectoryOn() {
  const { policy } = useConfig();
  return (policy("PEOPLE_DIRECTORY") ?? "on") === "on";
}

/** People matching q (2+ characters), debounced. null while loading. */
export function usePeopleSearch(q: string) {
  const on = useDirectoryOn();
  const [people, setPeople] = useState<PersonResult[] | null>([]);
  const text = q.trim().replace(/^@/, "");
  useEffect(() => {
    if (!on || text.length < 2) { setPeople([]); return; }
    setPeople(null);
    let alive = true;
    const t = setTimeout(() => get<{ people: PersonResult[] }>(`/api/v1/people?q=${encodeURIComponent(text)}`)
      .then((r) => alive && setPeople(r.people)).catch(() => alive && setPeople([])), 250);
    return () => { alive = false; clearTimeout(t); };
  }, [text, on]);
  return people;
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(/[\s_]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-chip-active font-semibold text-primary ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">{initials}</span>
  );
}

const LABEL: Record<ConnectionState, string> = { none: "Connect", outgoing: "Requested", incoming: "Accept", connected: "Connected", self: "" };

/** Connect / Requested / Accept / Connected. Accept answers their request; asking back does the same on the server. */
export function ConnectButton({ handle, state, onChange, className = "" }: { handle: string; state: ConnectionState; onChange?: (s: ConnectionState) => void; className?: string }) {
  const [s, setS] = useState(state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setS(state), [state]);
  if (s === "self") return null;
  const act = async () => {
    setBusy(true); setError(null);
    try {
      const r = await post<{ connection: { status: string } }>("/api/v1/connections", { handle });
      const next: ConnectionState = r.connection.status === "accepted" ? "connected" : "outgoing";
      setS(next); onChange?.(next);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't connect."); } finally { setBusy(false); }
  };
  const clickable = s === "none" || s === "incoming";
  return (
    <span className={`inline-flex flex-col items-end gap-1 ${className}`}>
      <Button kind={clickable ? "primary" : "secondary"} disabled={!clickable} busy={busy} onClick={act} className="text-xs">
        {s === "connected" && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>}
        {LABEL[s]}
      </Button>
      {error && <span className="text-xs text-unread">{error}</span>}
    </span>
  );
}
