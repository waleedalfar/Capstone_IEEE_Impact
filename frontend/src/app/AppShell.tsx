/* Event_Ecosystem's sticky glass header (docs/DESIGN.md "Layout"), with real routes instead of dead links. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { get } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, useDirectoryOn, usePeopleSearch } from "@/modules/social/people";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/profile", label: "Profile" },
  { to: "/moves", label: "Moves" },
  { to: "/growth", label: "Growth" },
  { to: "/buddies", label: "Buddies" },
];

export function UserButton({ onClick, label = "Open profile menu" }: { onClick?: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="relative size-11 shrink-0 rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <img className="absolute inset-0 size-11" src="/icons/avatar-circle.svg" alt="" />
      <img className="absolute left-[10px] top-[9px] size-6" src="/icons/user.svg" alt="" />
    </button>
  );
}

export function Logo() {
  return (
    <Link to="/" className="app-brand" aria-label="Impact++ home">
      <img src="/icons/ieee-logo.png" alt="IEEE" className="app-brand-logo" />
      <span className="app-brand-name">Impact++</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const directory = useDirectoryOn();
  const people = usePeopleSearch(searchOpen ? q : "");
  const text = q.trim();
  const go = (to: string) => { setSearchOpen(false); setQ(""); nav(to); };

  useEffect(() => {
    let alive = true;
    const load = () => get<{ unread: number }>("/api/v1/feed?unread=true").then((r) => alive && setUnread(r.unread)).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [loc.pathname]);

  useEffect(() => { setMenu(false); setMobile(false); setSearchOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="page-bg min-h-dvh text-navy">
      <header className="theme-header sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-lg">
        <div className="mx-auto flex min-h-[104px] max-w-[1280px] items-center gap-5 px-5 py-5 lg:gap-6 lg:px-7">
          <Logo />
          <nav className="hidden items-center gap-5 text-sm tracking-[-0.42px] md:flex" aria-label="Primary">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `${isActive ? "font-semibold text-navy" : "font-medium text-primary"} transition-opacity hover:opacity-60`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          {/* Search (D-54): people as you type; Enter opens all matching people in Buddies, Connections.
              Notifications stay one click away. With PEOPLE_DIRECTORY off it searches notifications, as before. */}
          <div ref={searchRef} className="relative ml-auto min-w-0 flex-1 sm:max-w-[540px]">
            <form role="search" className="flex h-[49px] items-center rounded-[20px] bg-search pl-5 pr-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text) return;
                go(directory ? `/buddies?tab=connections&q=${encodeURIComponent(text)}` : `/?q=${encodeURIComponent(text)}#notifications`);
              }}>
              <input value={q} onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}
                placeholder={directory ? "Search people or notifications..." : "Search notifications..."}
                aria-label={directory ? "Search people or notifications" : "Search notifications"} aria-expanded={searchOpen && !!text} aria-controls="search-results"
                className="min-w-0 flex-1 bg-transparent text-[15px] tracking-[-0.45px] text-text outline-none placeholder:text-border" />
              <button type="submit" aria-label="Search" className="relative ml-2 size-[30px] shrink-0 rounded-full transition-transform hover:scale-105">
                <img className="absolute inset-0 size-[30px]" src="/icons/search-circle.svg" alt="" />
                <img className="absolute left-[7px] top-[7px] size-4" src="/icons/search.svg" alt="" />
              </button>
            </form>
            {searchOpen && text && (
              <div id="search-results" className="absolute inset-x-0 top-[56px] z-40 overflow-hidden rounded-xl border border-border bg-white text-sm shadow-lg">
                {directory && (
                  <div className="p-2">
                    <p className="px-3 pb-1 pt-1 text-xs font-semibold text-secondary">People</p>
                    {text.replace(/^@/, "").length < 2 ? <p className="px-3 py-2 text-secondary">Keep typing to find people.</p>
                      : people === null ? <p className="px-3 py-2 text-secondary">Searching...</p>
                      : people.length === 0 ? <p className="px-3 py-2 text-secondary">No one matches "{text}".</p>
                      : people.slice(0, 6).map((p) => (
                        <button key={p.handle} type="button" onClick={() => go(`/people/${p.handle}`)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-search focus-visible:bg-search focus-visible:outline-none">
                          <Avatar name={p.displayName} size={34} />
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate font-semibold text-navy">{p.displayName}</strong>
                            <span className="block truncate text-xs text-secondary">@{p.handle}{p.headline ? ` · ${p.headline}` : ""}</span>
                          </span>
                          {p.connection === "connected" && <span className="text-xs font-semibold text-growth">Connected</span>}
                        </button>
                      ))}
                    {people && people.length > 6 && (
                      <button type="button" onClick={() => go(`/buddies?tab=connections&q=${encodeURIComponent(text)}`)}
                        className="w-full rounded-lg px-3 py-2 text-left font-semibold text-primary hover:bg-search">See all {people.length} people</button>
                    )}
                  </div>
                )}
                <button type="button" onClick={() => go(`/?q=${encodeURIComponent(text)}#notifications`)}
                  className="flex w-full items-center gap-2 border-t border-subpanel px-5 py-3 text-left text-primary hover:bg-search">
                  <img className="size-4" src="/icons/bell.svg" alt="" />Search notifications for "{text}"
                </button>
              </div>
            )}
          </div>
          <div className="relative flex shrink-0 items-center gap-4 sm:gap-6" ref={menuRef}>
            <button type="button" aria-label={unread ? `${unread} unread notifications` : "Notifications"} className="relative size-[25px]"
              onClick={() => nav("/#notifications")}>
              <img className="size-[25px]" src="/icons/bell.svg" alt="" />
              {unread > 0 && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-unread" />}
            </button>
            <button type="button" aria-label="Toggle menu" aria-expanded={mobile} className="size-[25px] md:hidden" onClick={() => setMobile((m) => !m)}>
              <img className="size-[25px]" src="/icons/menu.svg" alt="" />
            </button>
            <UserButton onClick={() => setMenu((m) => !m)} />
            {menu && (
              <div className="absolute right-0 top-14 w-56 rounded-xl border border-border bg-white p-2 text-sm shadow-lg">
                <p className="truncate px-3 py-2 text-xs text-secondary">{me?.displayName || me?.email}{me?.handle ? ` · @${me.handle}` : ""}</p>
                <Link to="/profile" className="block rounded-lg px-3 py-2 hover:bg-search">View profile</Link>
                <Link to="/buddies" className="block rounded-lg px-3 py-2 hover:bg-search">Buddies and reviews</Link>
                <Link to="/settings" className="block rounded-lg px-3 py-2 hover:bg-search">Settings</Link>
                <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-search" onClick={async () => { await signOut(); nav("/auth/sign-in"); }}>Sign out</button>
              </div>
            )}
          </div>
        </div>
        {mobile && (
          <nav className="flex flex-col gap-1 border-t border-white/60 px-5 pb-4 md:hidden" aria-label="Primary mobile">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? "bg-chip-active font-semibold text-navy" : "text-primary"}`}>{n.label}</NavLink>)}
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto max-w-[1210px] px-5 pb-16 pt-2 lg:px-0">{children}</main>
    </div>
  );
}

/** Pages before sign-in: the same glass header with only the logo. */
export function BareShell({ children }: { children: ReactNode }) {
  return (
    <div className="page-bg min-h-dvh text-navy">
      <header className="theme-header sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-lg">
        <div className="mx-auto flex min-h-[104px] max-w-[1280px] items-center gap-5 px-5 py-5 lg:px-7">
          <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-[1210px] px-5 pb-16 pt-8 lg:px-0">{children}</main>
    </div>
  );
}
