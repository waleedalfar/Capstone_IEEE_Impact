import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it } from "vitest";
import SettingsPage from "@/modules/profile/SettingsPage";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

it("shows the dark mode setting and anchors its thumb to the correct side", () => {
  render(<MemoryRouter><SettingsPage /></MemoryRouter>);

  expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  const themeSwitch = screen.getByRole("switch", { name: "Dark mode" });
  const knob = themeSwitch.querySelector(".theme-switch-knob");
  expect(knob).toHaveClass("left-[18px]");

  fireEvent.click(themeSwitch);
  expect(themeSwitch).toHaveAttribute("aria-checked", "true");
  expect(knob).toHaveClass("left-0.5");
  expect(document.documentElement.dataset.theme).toBe("dark");

  fireEvent.click(themeSwitch);
  expect(themeSwitch).toHaveAttribute("aria-checked", "false");
  expect(knob).toHaveClass("left-[18px]");
});