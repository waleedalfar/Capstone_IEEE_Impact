import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AppShell } from "@/app/AppShell";

vi.mock("@/lib/api", () => ({ get: vi.fn().mockResolvedValue({ unread: 0 }) }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ me: { displayName: "Test User", handle: "test" }, signOut: vi.fn() }),
}));
vi.mock("@/modules/social/people", () => ({
  Avatar: () => <span />,
  useDirectoryOn: () => false,
  usePeopleSearch: () => [],
}));

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

it("links to the full settings page from the profile menu", () => {
  render(<MemoryRouter><AppShell><div>Content</div></AppShell></MemoryRouter>);

  expect(screen.queryByRole("switch", { name: "Dark mode" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open profile menu" }));

  expect(within(screen.getByRole("button", { name: "Sign out" }).parentElement!).getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
});