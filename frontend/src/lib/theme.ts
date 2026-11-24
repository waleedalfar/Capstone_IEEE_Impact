export type Theme = "light" | "dark";

const THEME_KEY = "impact.theme";

export function getThemePreference(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Theme changes still apply for this page when storage is unavailable.
  }
}