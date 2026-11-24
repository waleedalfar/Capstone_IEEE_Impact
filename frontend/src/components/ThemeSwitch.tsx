import { useState } from "react";
import { applyTheme, getThemePreference, type Theme } from "@/lib/theme";

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(getThemePreference);
  const dark = theme === "dark";
  const toggle = () => {
    const next = dark ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button type="button" role="switch" aria-label="Dark mode" aria-checked={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={toggle}
      className="flex h-10 shrink-0 items-center rounded-full p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <span className="relative h-5 w-9 rounded-full bg-secondary transition-colors" aria-hidden="true">
        <span className={`theme-switch-knob absolute top-0.5 size-4 rounded-full transition-[left] ${dark ? "left-0.5" : "left-[18px]"}`} />
      </span>
    </button>
  );
}