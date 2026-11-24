import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import LandingPage from "@/modules/public/LandingPage";

afterEach(cleanup);

it("describes the product and offers sign-in and account creation", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);

  expect(screen.getByRole("heading", { name: "Impact++", level: 1 })).toBeInTheDocument();
  expect(screen.getByText(/Turn what you want to do into progress you can show/)).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Sign in" })).toHaveLength(2);
  screen.getAllByRole("link", { name: "Sign in" }).forEach((link) => expect(link).toHaveAttribute("href", "/auth/sign-in"));
  expect(screen.getAllByRole("link", { name: /Create account|Get started|Create your account/ })).toHaveLength(3);
  expect(screen.getByRole("heading", { name: "Small steps. Real evidence. Visible growth." })).toBeInTheDocument();
  expect(screen.getByRole("list").children).toHaveLength(4);
});
