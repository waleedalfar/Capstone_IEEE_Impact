import { useEffect, useState } from "react";
import { Button, ErrorNote, PageTitle, Panel, PanelTitle, Skeleton } from "@/components/ui";
import { ApiError, get, put } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import type { ProfessionalState } from "@/lib/types";
import { BackgroundFields, BasicsFields, ContributionsFields, fromState, SkillsFields, toPayload, type Draft } from "./ProfileForm";

export default function ProfilePage() {
  const { refreshMe } = useAuth();
  const { catalog } = useConfig();
  const [profile, setProfile] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { get<{ profile: ProfessionalState }>("/api/v1/profile").then((r) => setProfile(fromState(r.profile))).catch(() => setError("Couldn't load your profile. Refresh to try again.")); }, []);
  if (!profile) return error ? <ErrorNote>{error}</ErrorNote> : <Skeleton className="h-64 w-full" />;
  const save = async () => {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      const r = await put<{ profile: ProfessionalState }>("/api/v1/profile", toPayload(draft, true));
      setProfile(fromState(r.profile)); setDraft(null); setSaved(true);
      await refreshMe().catch(() => {});
    } catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't save."); } finally { setBusy(false); }
  };
  const set = (p: Partial<Draft>) => setDraft((x) => x ? { ...x, ...p } : x);
  const career = catalog?.careers.find((c) => c.id === profile.targetCareerId)?.name;
  return <div className="flex flex-col gap-6">
    <PageTitle sub="View your professional information and update it whenever you need.">My profile</PageTitle>
    {draft ? <>
      <Panel><PanelTitle>About you</PanelTitle><BasicsFields d={draft} set={set} /></Panel>
      <Panel><PanelTitle>Background and target career</PanelTitle><BackgroundFields d={draft} set={set} /></Panel>
      <Panel><PanelTitle>Skills, strengths and growth areas</PanelTitle><SkillsFields d={draft} set={set} /></Panel>
      <Panel><PanelTitle>Featured contributions</PanelTitle><ContributionsFields d={draft} set={set} /></Panel>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-3"><Button busy={busy} onClick={save}>Save changes</Button><Button kind="secondary" disabled={busy} onClick={() => { setDraft(null); setError(null); }}>Cancel</Button></div>
    </> : <>
      <Panel><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">{profile.displayName || "Your profile"}</h2>{profile.handle && <p className="text-secondary">@{profile.handle}</p>}<p className="mt-2">{profile.headline || "No headline yet"}</p></div><Button onClick={() => { setDraft(profile); setSaved(false); }}>Edit profile</Button></div>{profile.bio && <p className="mt-4 whitespace-pre-wrap">{profile.bio}</p>}{saved && <p role="status" className="mt-3 text-sm text-growth">Profile saved.</p>}</Panel>
      <Panel><PanelTitle>Background and target career</PanelTitle><dl className="grid gap-4 md:grid-cols-2">{[["School", profile.education.institution], ["Major", profile.education.major], ["Graduation year", profile.education.gradYear], ["Current position", profile.position], ["Target career", career]].map(([label, value]) => <div key={label}><dt className="text-sm font-semibold">{label}</dt><dd className="text-secondary">{value || "Not provided"}</dd></div>)}</dl></Panel>
      <Panel><PanelTitle>Skills and goals</PanelTitle><div className="grid gap-5 md:grid-cols-2">{([{ label: "Technical and professional skills", values: profile.skills }, { label: "Interests", values: profile.interests }, { label: "Personal strengths", values: profile.strengths }, { label: "Growth areas", values: profile.growthAreas }]).map(({label, values}) => <div key={label}><h3 className="mb-2 text-sm font-semibold">{label}</h3><div className="flex flex-wrap gap-2">{values.length ? values.map((v) => <span key={v} className="rounded-lg bg-chip-active px-3 py-1 text-sm text-primary">{v}</span>) : <p className="text-sm text-secondary">None added yet</p>}</div></div>)}</div></Panel>
      <Panel><PanelTitle>Featured contributions</PanelTitle>{profile.featuredContributions.length ? profile.featuredContributions.map((c, i) => <article key={c.id ?? i} className="mb-3 rounded-lg bg-white p-4"><h3 className="font-semibold">{c.title}</h3><p className="text-xs text-secondary">{c.type} · {c.verificationStatus === "verified" ? "Verified" : "Self-reported"}</p><p className="mt-2 whitespace-pre-wrap">{c.description}</p></article>) : <p className="text-secondary">No contributions added yet.</p>}</Panel>
    </>}
  </div>;
}
