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
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ needsOnboarding: false }), { status: 200 })));
});

describe("GardenLoginPage rendering", () => {
  it("renders the approved split brand and form layout", () => {
    render(<GardenLoginPage />);

    const brand = screen.getByTestId("login-brand-panel");
    expect(screen.getByTestId("login-section")).toBeInTheDocument();
    expect(brand.querySelector("img")).toHaveAttribute("src", "/themes/garden-shell/images/login/mark-tree-emblem.png");
    expect(screen.getByRole("heading", { name: "おはようございます" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    expect(brand).toHaveTextContent("今日の業務をここから始めましょう。経理・営業・カスタマーサポートの仕事を、ひとつの場所にまとめています。");
    expect(screen.getByTestId("login-brand-icons").children).toHaveLength(12);
    expect(screen.queryByText("Enter the Garden")).not.toBeInTheDocument();
  });

  it("keeps the required form controls and forgot password link", () => {
    render(<GardenLoginPage />);

    expect(screen.getByTestId("login-empid")).toBeInTheDocument();
    expect(screen.getByTestId("login-password")).toBeInTheDocument();
    expect(screen.getByTestId("login-keep")).toBeInTheDocument();
    expect(screen.getByTestId("login-password-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("login-submit")).toHaveTextContent("ログイン");
    expect(screen.getByTestId("login-empid")).toHaveAttribute("name", "employeeIdOrPartnerCode");
    expect(screen.getByTestId("login-empid")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByTestId("login-password")).toHaveAttribute("autocomplete", "current-password");
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
    const toggle = screen.getByTestId("login-password-toggle");

    expect(password).toHaveAttribute("type", "password");
    expect(toggle).toHaveTextContent("表示");
    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(toggle).toHaveTextContent("隠す");
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
    expect(fetch).toHaveBeenCalledWith("/api/system/onboarding/status", {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
  });

  it("redirects employees with draft onboarding to /system/onboarding after login", async () => {
    mocks.signInUnified.mockResolvedValue({ success: true, userId: "u1" });
    mocks.fetchBloomUser.mockResolvedValue({ garden_role: "staff" });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ needsOnboarding: true }), { status: 200 }));

    render(<GardenLoginPage />);
    fireEvent.change(screen.getByTestId("login-empid"), { target: { value: "8" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/system/onboarding"));
  });

  it("redirects closer users to /tree", async () => {
    mocks.signInUnified.mockResolvedValue({ success: true, userId: "u2" });
    mocks.fetchBloomUser.mockResolvedValue({ garden_role: "closer" });

    render(<GardenLoginPage />);
    fireEvent.change(screen.getByTestId("login-empid"), { target: { value: "9" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/tree"));
    expect(fetch).not.toHaveBeenCalled();
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
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps role redirect when onboarding status lookup fails", async () => {
    mocks.signInUnified.mockResolvedValue({ success: true, userId: "u4" });
    mocks.fetchBloomUser.mockResolvedValue({ garden_role: "staff" });
    vi.mocked(fetch).mockRejectedValue(new Error("network"));

    render(<GardenLoginPage />);
    fireEvent.change(screen.getByTestId("login-empid"), { target: { value: "11" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
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
