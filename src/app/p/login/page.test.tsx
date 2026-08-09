import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  searchParams: "",
  partnerSignIn: vi.fn(),
  signInUnified: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(mocks.searchParams),
}));
vi.mock("@/app/bloom/_lib/supabase", () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => mocks.partnerSignIn(...args) } },
}));
vi.mock("@/app/_lib/auth-unified", () => ({
  signInUnified: (...args: unknown[]) => mocks.signInUnified(...args),
}));
vi.mock("../_lib/auth", () => ({
  toTossEmail: (code: string) => `toss${code}@toss.garden.internal`,
}));

import TossLoginPage from "./page";

function submit(code: string, password = "pw") {
  fireEvent.change(screen.getByLabelText("パートナーコード または 社員番号"), { target: { value: code } });
  fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "ログイン" }));
}

describe("TossLoginPage", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.partnerSignIn.mockReset();
    mocks.signInUnified.mockReset();
    mocks.searchParams = "";
  });

  it("uses the existing toss authentication route for a seven-digit partner code", async () => {
    mocks.partnerSignIn.mockResolvedValue({ error: null });
    render(<TossLoginPage />);
    submit("1234567");

    await waitFor(() => expect(mocks.partnerSignIn).toHaveBeenCalledWith({ email: "toss1234567@toss.garden.internal", password: "pw" }));
    expect(mocks.signInUnified).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/p/toss");
  });

  it("uses unified staff authentication for a shorter employee number", async () => {
    mocks.signInUnified.mockResolvedValue({ success: true, userId: "staff-1" });
    mocks.searchParams = "returnTo=%2Fp%2Ftoss%2Fboard";
    render(<TossLoginPage />);
    submit("0008");

    await waitFor(() => expect(mocks.signInUnified).toHaveBeenCalledWith("0008", "pw"));
    expect(mocks.partnerSignIn).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/p/toss/board");
  });

  it("shows the same generic message when authentication fails", async () => {
    mocks.signInUnified.mockResolvedValue({ success: false, error: "internal detail" });
    render(<TossLoginPage />);
    submit("0008", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent("コードまたはパスワードが違います");
    expect(screen.queryByText("internal detail")).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
