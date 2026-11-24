import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AppShell, BareShell } from "@/app/AppShell";
import SettingsPage from "@/modules/profile/SettingsPage";

vi.mock("@/lib/api", () => ({ get: vi.fn().mockResolvedValue({ unread: 0 }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ me: { displayName: "Test User", handle: "test" }, signOut: vi.fn() }) }));
vi.mock("@/modules/social/people", () => ({ Avatar: () => <span />, useDirectoryOn: () => false, usePeopleSearch: () => [] }));

let storage = new Map<string, string>();

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

it("keeps Settings available from the profile dropdown", () => {
  render(<MemoryRouter><AppShell><div>Home content</div></AppShell></MemoryRouter>);
  expect(screen.getByRole("img", { name: "IEEE" })).toHaveClass("app-brand-logo");
  fireEvent.click(screen.getByRole("button", { name: "Open profile menu" }));
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
});

it("shows the Impact++ wordmark only once in the auth header", () => {
  render(<MemoryRouter><BareShell><div>Sign-in content</div></BareShell></MemoryRouter>);
  expect(screen.getAllByText("Impact++")).toHaveLength(1);
});

it("persists dark mode from the dedicated Settings page", () => {
  render(<MemoryRouter><SettingsPage /></MemoryRouter>);
  const toggle = screen.getByRole("switch", { name: "Dark mode" });
  expect(toggle).toHaveAttribute("aria-checked", "false");
  act(() => fireEvent.click(toggle));
  expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(toggle.querySelector(".theme-switch-knob")).toHaveClass("left-0.5");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(storage.get("impact.theme")).toBe("dark");
});