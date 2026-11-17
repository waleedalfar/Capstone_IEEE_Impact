/* Module 3: an opportunity's pop-up. Locked: how to unlock it, from the server's plan (growth/scoring.unlock_plan): the
   skill closest to the opportunity's tier and each gate that skill still has to meet, with progress. Each unmet step
   has a button to the place in the app where the user does it:
   - points: the Log evidence picker (a move, or past work);
   - validated items / a senior reviewer: the evidence waiting for review in that skill, where its reviewer is invited
     (the move's page for move evidence, the evidence page for past work); with none waiting, log evidence first;
   - a hard item: the wishes page to pick a hard move, or log hard past work;
   - an endorsement: admin-only (D-24), so there is nothing for the user to click. */
import { Button, ButtonLink, Modal, Progress, TierBadge } from "@/components/ui";
import { ago } from "@/lib/format";
import type { Evidence, Gate, Unlock } from "@/lib/types";
import { LogEvidenceButton } from "./LogEvidence";
import { OpportunityIcon } from "./OpportunityIcon";

type Action = NonNullable<Gate["action"]>;
const HELP: Record<Action, string> = {
  earn_points: "Points come from evidence that passes the rubric. Do a move or log past work in this skill.",
  validate_items: "Evidence counts once a reviewer confirms it (or the review window passes).",
  hard_item: "Pick a move marked hard, or log hard past work, and get it validated.",
  senior_reviewer: "Have evidence confirmed by a reviewer at Demonstrated or above.",
  endorsement: "An admin endorses the skill once the other steps are done. There's nothing to request yet.",
};
const WAITING = ["awaiting_review", "ai_scored"];

/** Where a reviewer is invited for this evidence: the move's page, or (past work) the evidence page. */
function reviewLink(e: Evidence) {
  return e.selectedMoveId && e.wishId ? `/moves/${e.wishId}?move=${e.selectedMoveId}` : `/growth/evidence/${e.id}`;
}

type Ctx = { evidence: Evidence[]; skillId: string | null; onLogged?: () => void };

function StepAction({ action, ctx }: { action: Action; ctx: Ctx }) {
  const cls = "self-start text-xs";
  const log = (label: string) => <LogEvidenceButton kind="secondary" className={cls} label={label} onLogged={ctx.onLogged} />;
  if (action === "earn_points") return log("Log evidence");
  if (action === "validate_items" || action === "senior_reviewer") {
    const waiting = ctx.evidence.find((e) => WAITING.includes(e.status) && (!ctx.skillId || e.skillId === ctx.skillId));
    if (!waiting) return <div className="flex flex-col gap-1"><span className="text-xs text-secondary">Nothing is waiting for review in this skill.</span>{log("Log evidence first")}</div>;
    return <ButtonLink kind="secondary" className={cls} to={reviewLink(waiting)}>{action === "senior_reviewer" ? "Invite a senior reviewer" : "Invite a reviewer"}</ButtonLink>;
  }
  if (action === "hard_item") {
    return (
      <div className="flex flex-wrap gap-2">
        <ButtonLink kind="secondary" className={cls} to="/moves">Find a hard move</ButtonLink>
        {log("Log hard past work")}
      </div>
    );
  }
  return <Button kind="secondary" className={cls} disabled title="An admin grants endorsements">Granted by an admin</Button>;
}

function Check({ met }: { met: boolean }) {
  return (
    <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${met ? "bg-growth text-white" : "border-2 border-border bg-white"}`} aria-hidden="true">
      {met && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>}
    </span>
  );
}

function Step({ g, ctx }: { g: Gate; ctx: Ctx }) {
  const progress = g.target ? (g.current ?? 0) / g.target : null;
  return (
    <li className={`flex gap-3 rounded-lg bg-white p-4 ${g.met ? "opacity-70" : ""}`}>
      <Check met={g.met} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <strong className="font-semibold capitalize text-black">{g.rule}</strong>
          {g.target != null && <span className="text-xs font-semibold text-time">{Math.round(g.current ?? 0)} / {g.target}</span>}
        </div>
        {progress != null && !g.met && <Progress value={progress} label={`${g.rule} progress`} />}
        {g.action && !g.met && <p className="text-xs text-secondary">{HELP[g.action]}</p>}
        {g.action && !g.met && <StepAction action={g.action} ctx={ctx} />}
      </div>
    </li>
  );
}

export function OpportunityDialog({ op, unlocked, evidence, onLogged, onClose }: {
  op: Unlock | null; unlocked: boolean; evidence: Evidence[]; onLogged?: () => void; onClose: () => void;
}) {
  const plan = op?.howToUnlock;
  const done = plan?.steps.filter((s) => s.met).length ?? 0;
  const total = plan?.steps.length ?? 0;
  return (
    <Modal open={!!op} onClose={onClose}
      title={op && <span className="flex items-center gap-3"><OpportunityIcon id={op.opportunityId} tier={op.tier} unlocked={unlocked} size={40} />{op.title}</span>}
      sub={op && <span className="flex flex-wrap items-center gap-2">Needs <TierBadge tier={op.tier} /> in a skill{unlocked ? " · Unlocked" : ""}</span>}>
      {op && <p className="text-[15px] text-text">{op.description}</p>}
      {op && unlocked ? (
        <div className="flex items-center gap-3 rounded-lg bg-growth-bg p-4 text-growth">
          <Check met />
          <p className="text-sm font-semibold">You've unlocked this{op.unlockedAt ? ` ${ago(op.unlockedAt)}` : ""}.</p>
        </div>
      ) : plan && (
        <>
          <div className="flex flex-col gap-2 rounded-lg bg-subpanel p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-navy">How to unlock</span>
              <span className="text-xs font-semibold text-secondary">{done} of {total} done</span>
            </div>
            <Progress value={total ? done / total : 0} label="Unlock progress" />
            <p className="text-xs text-secondary">
              {plan.skillName
                ? <>Your closest skill is <strong className="text-navy">{plan.skillName}</strong> ({plan.currentTier}). Get it to {op?.tier}:</>
                : "Choose a target career on your profile to start tracking skills."}
            </p>
          </div>
          <ol className="flex flex-col gap-2">{plan.steps.map((g) => <Step key={g.rule} g={g} ctx={{ evidence, skillId: plan.skillId, onLogged }} />)}</ol>
        </>
      )}
    </Modal>
  );
}
