import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import ResetPassword from "@/modules/auth/ResetPassword";

const { resetPasswordForEmail, onAuthStateChange, updateUser } = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  onAuthStateChange: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { resetPasswordForEmail, onAuthStateChange, updateUser } },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-23T12:00:00Z"));
  resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  updateUser.mockReset();
  onAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("activates resend after one minute and restarts the cooldown after sending", async () => {
  render(<MemoryRouter><ResetPassword /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "student@example.com" } });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  });

  expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Resend reset email in 60s" })).toBeDisabled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(59_000);
  });
  expect(screen.getByRole("button", { name: "Resend reset email in 1s" })).toBeDisabled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });
  const resend = screen.getByRole("button", { name: "Resend reset email" });
  expect(resend).toBeEnabled();

  await act(async () => {
    fireEvent.click(resend);
  });

  expect(resetPasswordForEmail).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "Resend reset email in 60s" })).toBeDisabled();
});

it("shows inline feedback for an invalid email before requesting a reset", async () => {
  render(<MemoryRouter><ResetPassword /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  });

  expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  expect(resetPasswordForEmail).not.toHaveBeenCalled();
});

it("asks for an email address when the field is empty", async () => {
  render(<MemoryRouter><ResetPassword /></MemoryRouter>);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  });

  expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  expect(resetPasswordForEmail).not.toHaveBeenCalled();
});
