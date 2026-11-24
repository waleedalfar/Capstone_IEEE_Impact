/* Module 1 (Professional State, owner Cfoley5): the profile fields from the Professional-State branch plus strengths,
   target career and handle (D-44, D-51). Used by onboarding and the Profile page. */
import { useEffect, useState } from "react";
import { Button, Field, Input, Select, TagInput, TextArea } from "@/components/ui";
import { get } from "@/lib/api";
import { useConfig } from "@/lib/config";
import type { Contribution, ProfessionalState } from "@/lib/types";

export type Draft = Omit<ProfessionalState, "schemaVersion" | "userId" | "onboardingCompletedAt" | "version">;

export const emptyDraft = (): Draft => ({
  handle: "", displayName: "", headline: "", bio: "", education: { institution: "", major: "", gradYear: null }, position: "Student",
  targetCareerId: null, targetCareerOther: null, skills: [], interests: [], strengths: [], growthAreas: [], featuredContributions: [],
});

export function fromState(s: ProfessionalState): Draft {
  const { schemaVersion: _a, userId: _b, onboardingCompletedAt: _c, version: _d, ...rest } = s;
  return { ...rest, handle: rest.handle ?? "" };
}

export function mergeImport(d: Draft, imp: Partial<Draft>): Draft {
  const keep = (a: string, b?: string) => (a?.trim() ? a : b ?? a);
  const union = (a: string[], b?: string[]) => [...new Set([...a, ...(b ?? [])])];
  return {
    ...d,
    displayName: keep(d.displayName, imp.displayName), headline: keep(d.headline, imp.headline), bio: keep(d.bio, imp.bio),
    position: keep(d.position === "Student" ? "" : d.position, imp.position) || d.position,
    education: { institution: keep(d.education.institution, imp.education?.institution), major: keep(d.education.major, imp.education?.major), gradYear: d.education.gradYear ?? imp.education?.gradYear ?? null },
    targetCareerId: d.targetCareerId ?? (d.targetCareerOther ? null : imp.targetCareerId ?? null),
    targetCareerOther: d.targetCareerId ? null : d.targetCareerOther || imp.targetCareerOther || null,
    skills: union(d.skills, imp.skills), interests: union(d.interests, imp.interests), strengths: union(d.strengths, imp.strengths),
    growthAreas: union(d.growthAreas, imp.growthAreas),
    featuredContributions: [...d.featuredContributions, ...(imp.featuredContributions ?? [])].slice(0, 10),
  };
}

export function HandleField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [state, setState] = useState<{ ok: boolean; reason?: string } | null>(null);
  useEffect(() => {
    const h = value.trim().toLowerCase();
    if (!h) { setState(null); return; }
    const t = setTimeout(() => get<{ available: boolean; reason?: string }>(`/api/v1/profile/handle-available?h=${encodeURIComponent(h)}`)
      .then((r) => setState({ ok: r.available, reason: r.reason })).catch(() => setState(null)), 350);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <Field label="Username" hint={state?.ok ? "Available." : "Others can find and invite you using this username. 3 to 24 lowercase letters, digits or _."}
      error={state && !state.ok ? state.reason ?? "That username is taken." : null}>
      <Input value={value} onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} maxLength={24} placeholder="sam_r" autoComplete="off" />
    </Field>
  );
}

export function BasicsFields({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Name"><Input placeholder="e.g. Alex Morgan" value={d.displayName} maxLength={80} onChange={(e) => set({ displayName: e.target.value })} /></Field>
      <HandleField value={d.handle ?? ""} onChange={(handle) => set({ handle })} />
      <div className="md:col-span-2"><Field label="Professional headline" hint="A short professional introduction or career aspiration."><Input placeholder="e.g. CS student interested in AI" value={d.headline} maxLength={120} onChange={(e) => set({ headline: e.target.value })} /></Field></div>
      <div className="md:col-span-2"><Field label="About you" hint="Optional free text. Describe your background in your own words. Never sent to the move generator."><TextArea placeholder="e.g. I enjoy building web applications and working with teams." value={d.bio} maxLength={1000} onChange={(e) => set({ bio: e.target.value })} /></Field></div>
    </div>
  );
}

const OTHER = "__other";

/** The career picker's value: a listed career id, OTHER when the student types their own (D-55), or "". */
export function careerChoice(d: Draft): string {
  return d.targetCareerId ?? (d.targetCareerOther != null ? OTHER : "");
}

export function careerLabel(d: Draft, careers: { id: string; name: string }[] | undefined): string | null {
  return careers?.find((c) => c.id === d.targetCareerId)?.name ?? (d.targetCareerOther?.trim() || null);
}

export function BackgroundFields({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const { catalog, policy } = useConfig();
  const otherAllowed = policy("CAREER_OTHER") !== false;
  const choice = careerChoice(d);
  const options = (catalog?.careers ?? []).map((c) => ({ value: c.id, label: c.name }));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="School"><Input placeholder="e.g. Arizona State University" value={d.education.institution} maxLength={120} onChange={(e) => set({ education: { ...d.education, institution: e.target.value } })} /></Field>
      <Field label="Major"><Input placeholder="e.g. Computer Science" value={d.education.major} maxLength={120} onChange={(e) => set({ education: { ...d.education, major: e.target.value } })} /></Field>
      <Field label="Graduation year"><Input placeholder="2027" type="number" min={1990} max={2040} value={d.education.gradYear ?? ""} onChange={(e) => set({ education: { ...d.education, gradYear: e.target.value ? Number(e.target.value) : null } })} /></Field>
      <Field label="Current position"><Input value={d.position} maxLength={80} onChange={(e) => set({ position: e.target.value })} placeholder="Student, intern, ..." /></Field>
      <div className="md:col-span-2">
        <Field label="Target career" hint={choice === OTHER ? "Your growth is tracked against the skills you list on the next step." : "Your growth is tracked against this career's skills."}>
          <Select value={choice} placeholder="Choose a career"
            onChange={(v) => set(v === OTHER ? { targetCareerId: null, targetCareerOther: d.targetCareerOther ?? "" } : { targetCareerId: v || null, targetCareerOther: null })}
            options={otherAllowed ? [...options, { value: OTHER, label: "Other (type it)" }] : options} />
        </Field>
        {choice === OTHER && (
          <div className="mt-3"><Field label="Your target career"><Input value={d.targetCareerOther ?? ""} maxLength={60} placeholder="Nuclear engineer"
            onChange={(e) => set({ targetCareerOther: e.target.value })} /></Field></div>
        )}
        {d.targetCareerId && (
          <p className="mt-2 text-xs text-secondary">Skills: {catalog?.careers.find((c) => c.id === d.targetCareerId)?.skills.map((s) => s.name).join(", ")}</p>
        )}
      </div>
    </div>
  );
}

function SkillSuggestions({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { catalog } = useConfig();
  const [query, setQuery] = useState("");
  const options = [...new Set([...(catalog?.careers ?? []).flatMap((c) => c.skills.map((s) => s.name)), "Python", "Java", "JavaScript", "TypeScript", "SQL", "React", "Git", "Docker", "Linux", "Excel", "Data Analysis", "C++"])];
  const matches = options.filter((s) => s.toLowerCase().includes(query.trim().toLowerCase()) && !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 6);
  const add = (raw: string) => { const s = raw.trim().slice(0, 40); if (s && value.length < 30 && !value.some((v) => v.toLowerCase() === s.toLowerCase())) onChange([...value, s]); setQuery(""); };
  return <div className="grid gap-2">
    <div className="flex flex-wrap gap-2">{value.map((s) => <button key={s} type="button" className="rounded-lg border border-primary bg-chip-active px-3 py-1 text-sm text-primary" aria-label={`Remove ${s}`} onClick={() => onChange(value.filter((v) => v !== s))}>{s} ×</button>)}</div>
    <Input aria-label="Search skills" value={query} maxLength={40} disabled={value.length >= 30} placeholder="Search skills, e.g. Python" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(query); } }} />
    {query.trim() && value.length < 30 && <div className="grid gap-1 rounded-lg border border-border bg-white p-2">{matches.map((s) => <button key={s} type="button" className="rounded px-2 py-1 text-left text-sm hover:bg-search" onClick={() => add(s)}>{s}</button>)}<button type="button" className="px-2 py-1 text-left text-sm font-semibold text-primary" onClick={() => add(query)}>Add “{query.trim()}”</button></div>}
  </div>;
}

export function SkillsFields({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="grid content-start gap-2"><span className="text-sm font-semibold text-navy">Technical and professional skills</span><p className="text-xs text-secondary">Tools and practical abilities. Type to see suggestions, or add your own with Enter.</p><SkillSuggestions value={d.skills} onChange={(skills) => set({ skills })} /></div>
      <Field label="Interests" hint="Topics you enjoy. Type freely and press Enter after each."><TagInput value={d.interests} onChange={(interests) => set({ interests })} placeholder="sports analytics" /></Field>
      <Field label="Personal strengths" hint="Personal qualities, such as teamwork or communication. Press Enter after each."><TagInput value={d.strengths} max={10} onChange={(strengths) => set({ strengths })} placeholder="explaining results" /></Field>
      <Field label="Growth areas" hint="Skills or abilities you want to improve. Used to personalize recommended career activities. Press Enter after each."><TagInput value={d.growthAreas} max={10} onChange={(growthAreas) => set({ growthAreas })} placeholder="statistics" /></Field>
    </div>
  );
}

export function ContributionsFields({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const list = d.featuredContributions;
  const update = (i: number, p: Partial<Contribution>) => set({ featuredContributions: list.map((c, j) => (i === j ? { ...c, ...p } : c)) });
  return (
    <div className="flex flex-col gap-3">
      {list.map((c, i) => (
        <div key={i} className="grid gap-3 rounded-lg bg-white p-4 md:grid-cols-[1fr_180px_auto]">
          <Input value={c.title} maxLength={120} placeholder="Project, course or job" onChange={(e) => update(i, { title: e.target.value })} />
          <Select value={c.type} onChange={(v) => update(i, { type: v as Contribution["type"] })}
            options={[{ value: "project", label: "Project" }, { value: "coursework", label: "Coursework" }, { value: "professional", label: "Professional" }, { value: "other", label: "Other" }]} />
          <Button kind="text" onClick={() => set({ featuredContributions: list.filter((_, j) => j !== i) })}>Remove</Button>
          <div className="md:col-span-3"><TextArea rows={2} value={c.description} maxLength={1000} placeholder="One or two sentences" onChange={(e) => update(i, { description: e.target.value })} /></div>
          {c.verificationStatus === "verified" && <span className="text-xs font-semibold text-growth md:col-span-3">Verified by validated evidence</span>}
        </div>
      ))}
      {list.length < 10 && (
        <Button kind="secondary" className="self-start" onClick={() => set({ featuredContributions: [...list, { title: "", type: "project", description: "", verificationStatus: "self_reported" }] })}>
          Add a contribution
        </Button>
      )}
    </div>
  );
}

export function toPayload(d: Draft, complete: boolean) {
  return {
    ...d, handle: d.handle?.trim() || null,
    featuredContributions: d.featuredContributions.filter((c) => c.title.trim()).map(({ id: _id, ...c }) => c),
    completeOnboarding: complete,
  };
}