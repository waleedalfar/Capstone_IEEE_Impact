import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import SignIn from "@/modules/auth/SignIn";

const { signInWithPassword } = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ session: null }) }));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signInWithPassword } },
}));

beforeEach(() => signInWithPassword.mockReset());
afterEach(cleanup);

async function renderSignIn(email = "student@example.com") {
  render(<MemoryRouter><SignIn /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  });
}

it("explains incorrect credentials without revealing whether the email exists", async () => {
  signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", message: "Invalid login credentials" } });
  await renderSignIn();

  expect(await screen.findByText(/Email or password is incorrect/)).toBeInTheDocument();
  expect(screen.getByText(/reset your password/)).toBeInTheDocument();
  expect(screen.queryByText("Invalid login credentials")).not.toBeInTheDocument();
});

it("shows inline feedback for a malformed email instead of browser-blocking submission", async () => {
  await renderSignIn("adsadfda");

  expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
  expect(signInWithPassword).not.toHaveBeenCalled();
});

it("gives a retry hint for other sign-in failures", async () => {
  signInWithPassword.mockResolvedValue({ error: { code: "unexpected_failure", message: "Internal server error" } });
  await renderSignIn();

  expect(await screen.findByText(/Check your connection and try again/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
});