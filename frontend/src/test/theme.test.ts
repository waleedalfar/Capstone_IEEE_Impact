import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applyTheme, getThemePreference } from "@/lib/theme";

let values: Map<string, string>;

beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    clear: () => values.clear(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

it("defaults to light mode and restores a saved dark preference", () => {
  expect(getThemePreference()).toBe("light");
  localStorage.setItem("impact.theme", "dark");
  expect(getThemePreference()).toBe("dark");
});

it("applies and persists the selected theme", () => {
  applyTheme("dark");

  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  expect(localStorage.getItem("impact.theme")).toBe("dark");
});