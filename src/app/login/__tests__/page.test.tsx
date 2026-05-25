import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  searchParams: "",
  signInUnified: vi.fn(),
  fetchBloomUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.searchParams),
}));

vi.mock("../../_lib/auth-unified", () => {
  const sanitizeReturnTo = (raw: string | null | undefined) => {
    if (!raw) return null;
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
    return decoded;
  };

  return {
    sanitizeReturnTo,
    signInUnified: (...args: unknown[]) => mocks.signInUnified(...args),
  };
});

vi.mock("../../bloom/_lib/auth", () => ({
  fetchBloomUser: (...args: unknown[]) => mocks.fetchBloomUser(...args),
}));

import GardenLoginPage from "../page";

beforeEach(() => {
  mocks.push.mockReset();
  mocks.signInUnified.mockReset();
  mocks.fetchBloomUser.mockReset();
  mocks.searchParams = "";
});

describe("GardenLoginPage rendering", () => {
  it("renders the twilight Garden Series login", () => {
    render(<GardenLoginPage />);

    expect(screen.getByTestId("login-section")).toBeInTheDocument();
    expect(screen.getByAltText("Garden Series")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome to the Garden" })).toBeInTheDocument();
    expect(screen.getByText("夜明け前の庭から、今日の業務へ。")).toBeInTheDocument();
  });

  it("keeps the required form controls and forgot password link", () => {
    render(<GardenLoginPage />);

    expect(screen.getByTestId("login-empid")).toBeInTheDocument();
    expect(screen.getByTestId("login-password")).toBeInTheDocument();
    expect(screen.getByTestId("login-keep")).toBeInTheDocument();
    expect(screen.getByTestId("login-password-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("login-submit")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "パスワードをお忘れですか？" })).toHaveAttribute("href", "/login/forgot");
  });

  it("shows an expired-session warning from the query string", () => {
    mocks.searchParams = "reason=expired";
    render(<GardenLoginPage />);

    expect(screen.getByRole("status")).toHaveTextContent("セッションが期限切れになりました");
  });

  it("toggles password visibility", () => {
    render(<GardenLoginPage />);
    const password = screen.getByTestId("login-password");

    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByTestId("login-password-toggle"));
    expect(password).toHaveAttribute("type", "text");
  });
});

describe("GardenLoginPage submit flow", () => {
  it("uses signInUnified and redirects staff users to home", async () => {
    mocks.signInUnified.mockResolvedValue({ success: true, userId: "u1" });
    mocks.fetchBloomUser.mockResolvedValue({ garden_role: "staff" });

    render(<GardenLoginPage />);
    fireEvent.change(screen.getByTestId("login-empid"), { target: { value: " 8 " } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    await waitFor(() => expect(mocks.signInUnified).toHaveBeenCalledWith("8", "pw"));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
  });

  it("redirects closer users to /tree", async () => {
    mocks.signInUnified.mockResolvedValue({ success: true, userId: "u2" });
    mocks.fetchBloomUser.mockResolvedValue({ garden_role: "closer" });

    render(<GardenLoginPage />);
    fireEvent.change(screen.getByTestId("login-empid"), { target: { value: "9" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/tree"));
  });

  it("lets a safe returnTo override role redirect", async () => {
    mocks.searchParams = "returnTo=%2Fbloom%2Fprogress";
    mocks.signInUnified.mockResolvedValue({ success: true, userId: "u3" });
    mocks.fetchBloomUser.mockResolvedValue({ garden_role: "staff" });

    render(<GardenLoginPage />);
    fireEvent.change(screen.getByTestId("login-empid"), { target: { value: "10" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/bloom/progress"));
  });

  it("shows an error and does not redirect on signInUnified failure", async () => {
    mocks.signInUnified.mockResolvedValue({ success: false, error: "wrong password" });

    render(<GardenLoginPage />);
    fireEvent.change(screen.getByTestId("login-empid"), { target: { value: "8" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("wrong password"));
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
