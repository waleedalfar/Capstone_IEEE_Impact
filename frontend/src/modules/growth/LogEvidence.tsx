/* Module 3: "Log evidence" from anywhere (Home, Growth, a wish). Evidence is for one of two things:
   - a move you're on (D-11): the same form the move page uses, and submitting it moves that move along;
   - past work toward a wish: something you already did. It's graded and can get its own reviewer, but it never
     completes or unlocks a move, so the wish's one-move-at-a-time path stays as it is.
   Only moves the backend still accepts evidence for are offered (growth/service.submit). */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Button, ButtonLink, ErrorNote, Skeleton, Tag } from "@/components/ui";
import { get } from "@/lib/api";
import { STATUS_LABEL } from "@/lib/format";
import type { Evidence, GrowthState, SelectedSummary, Wish } from "@/lib/types";
import { EvidenceForm } from "./EvidenceForm";

const OPEN_STATUSES = "active,needs_work,evidence_submitted";

type Picked = { kind: "move"; move: SelectedSummary } | { kind: "wish"; wish: { id: string; text: string } };
type Loaded = { moves: SelectedSummary[]; wishes: Wish[]; evidence: Evidence[]; skills: { value: string; label: string }[] };

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function Row({ eyebrow, title, tag, onClick }: { eyebrow?: string; title: string; tag?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg bg-white p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary">
      <span className="min-w-0 flex-1">
        {eyebrow && <span className="block truncate text-xs font-semibold text-secondary">{eyebrow}</span>}
        <strong className="block font-semibold leading-6 text-black">{title}</strong>
      </span>
      {tag}
    </button>
  );
}

export function LogEvidenceButton({ kind = "primary", className = "", label = "Log evidence", wish, onLogged }: {
  kind?: "primary" | "secondary"; className?: string; label?: string;
  /** Open straight on "past work for this wish". */
  wish?: { id: string; text: string };
  onLogged?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Loaded | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [done, setDone] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setData(null); setError(null);
    Promise.all([
      get<{ selectedMoves: SelectedSummary[] }>(`/api/v1/selected-moves?status=${OPEN_STATUSES}`),
      get<{ wishes: Wish[] }>("/api/v1/wishes"),
      get<{ evidence: Evidence[] }>("/api/v1/evidence"),
      get<{ growth: GrowthState }>("/api/v1/growth"),
    ]).then(([m, w, e, g]) => {
      setData({
        moves: m.selectedMoves, wishes: w.wishes.filter((x) => x.status !== "abandoned"), evidence: e.evidence,
        skills: g.growth.skills.map((s) => ({ value: s.skillId, label: s.name })),
      });
    }).catch(() => setError("Couldn't load your moves and wishes."));
  };

  const show = () => { setPicked(wish ? { kind: "wish", wish } : null); setDone(null); setOpen(true); load(); dialog.current?.showModal(); };
  const close = () => { dialog.current?.close(); };

  useEffect(() => {
    const d = dialog.current;
    const onClose = () => setOpen(false);
    d?.addEventListener("close", onClose);
    return () => d?.removeEventListener("close", onClose);
  }, []);

  /** A move marked "needs work" gets a revision of its latest evidence, as on the move page. */
  const revisionOf = (m: SelectedSummary) => m.status === "needs_work"
    ? data?.evidence.filter((e) => e.selectedMoveId === m.selectedMoveId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id
    : undefined;

  const subtitle = done ? "Submitted." : picked?.kind === "move" ? "Show what you did for this move."
    : picked?.kind === "wish" ? "Something you already did that shows progress toward this wish." : "What is this evidence for?";

  return (
    <>
      <Button kind={kind} className={className} onClick={show}><PlusIcon />{label}</Button>
      <dialog ref={dialog} aria-labelledby="log-evidence-title"
        className="m-auto w-[min(640px,calc(100vw-32px))] rounded-xl border border-border bg-panel p-0 text-text backdrop:bg-black/40"
        onClick={(e) => { if (e.target === dialog.current) close(); }}>
        {open && (
          <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto px-6 pb-6 pt-5">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 id="log-evidence-title" className="text-xl font-bold text-primary">Log evidence</h2>
                <p className="text-sm text-secondary">{subtitle}</p>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="rounded-lg px-2 text-2xl leading-none text-secondary hover:text-text">×</button>
            </div>

            {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}

            {done ? (
              <div className="flex flex-col gap-4 rounded-lg bg-white p-5">
                <p className="text-[15px] text-text">
                  Your evidence is in. Its score and feedback show on the evidence page
                  {done.selectedMoveId ? "." : ", where you can also invite a reviewer to confirm it."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink to={`/growth/evidence/${done.id}`}>{done.selectedMoveId ? "See feedback" : "See feedback and invite a reviewer"}</ButtonLink>
                  <Button kind="secondary" onClick={close}>Done</Button>
                </div>
              </div>
            ) : !data && !error ? (
              <div className="flex flex-col gap-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
            ) : !data ? null : picked ? (
              <>
                <div className="flex items-center gap-3 rounded-lg bg-subpanel px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-secondary">
                      {picked.kind === "move" ? picked.move.wishText : "Past work for your wish"}
                    </span>
                    <strong className="block truncate font-semibold text-black">{picked.kind === "move" ? picked.move.title : picked.wish.text}</strong>
                  </span>
                  <Button kind="text" className="text-xs" onClick={() => setPicked(null)}>Change</Button>
                </div>
                {picked.kind === "move" ? (
                  <EvidenceForm key={picked.move.selectedMoveId} selectedMoveId={picked.move.selectedMoveId} revisionOf={revisionOf(picked.move)}
                    tags={{ skillId: picked.move.skillId, activityType: picked.move.activityType, difficulty: picked.move.difficulty }}
                    onSubmitted={(e) => { setDone(e); onLogged?.(); }} />
                ) : data.skills.length === 0 ? (
                  <div className="flex flex-col items-start gap-3 rounded-lg bg-white p-5">
                    <p className="text-[15px] text-text">Past work is scored against a skill you track. Choose a target career, or add your skills, on your profile first.</p>
                    <ButtonLink to="/profile">Open your profile</ButtonLink>
                  </div>
                ) : (
                  <EvidenceForm key={picked.wish.id} wishId={picked.wish.id} skillChoices={data.skills}
                    onSubmitted={(e) => { setDone(e); onLogged?.(); }} />
                )}
              </>
            ) : data.moves.length === 0 && data.wishes.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-lg bg-white p-5">
                <p className="text-[15px] text-text">Evidence is logged against a move or a wish, and you don't have one yet. Start a wish first.</p>
                <ButtonLink to="/moves/new">Start a wish</ButtonLink>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {data.moves.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-navy">A move you're on</h3>
                    <ul className="flex flex-col gap-2">
                      {data.moves.map((m) => (
                        <li key={m.selectedMoveId}>
                          <Row eyebrow={m.wishText} title={m.title} onClick={() => setPicked({ kind: "move", move: m })}
                            tag={<Tag tone={m.status === "needs_work" ? "impact" : "neutral"}>{STATUS_LABEL[m.status] ?? m.status}</Tag>} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {data.wishes.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-navy">Past work toward a wish</h3>
                    <p className="text-xs text-secondary">Something you did before that counts toward the wish's skills and unlocks. It doesn't complete your current move.</p>
                    <ul className="flex flex-col gap-2">
                      {data.wishes.map((w) => (
                        <li key={w.id}><Row title={w.text} onClick={() => setPicked({ kind: "wish", wish: { id: w.id, text: w.text } })} tag={<Tag tone="pro">Past work</Tag>} /></li>
                      ))}
                    </ul>
                  </section>
                )}
                <p className="text-xs text-secondary">Don't see it? <Link className="text-primary" to="/moves/new" onClick={close}>Start a new wish</Link>.</p>
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
