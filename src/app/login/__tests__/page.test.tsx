import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const signInBloomMock = vi.fn();
const fetchBloomUserMock = vi.fn();
vi.mock("../../bloom/_lib/auth", () => ({
  signInBloom: (...args: unknown[]) => signInBloomMock(...args),
  fetchBloomUser: (...args: unknown[]) => fetchBloomUserMock(...args),
}));

import GardenLoginPage from "../page";

beforeEach(() => {
  pushMock.mockReset();
  signInBloomMock.mockReset();
  fetchBloomUserMock.mockReset();
});

describe("GardenLoginPage — rendering", () => {
  it("renders Garden Series logo + 業務を、育てる subtitle", () => {
    render(<GardenLoginPage />);
    expect(screen.getByAltText("Garden Series")).toBeInTheDocument();
    expect(screen.getByText("業務を、育てる")).toBeInTheDocument();
  });
  it("renders 3 form inputs (empId / password / keepLogin)", () => {
    render(<GardenLoginPage />);
    expect(screen.getByTestId("login-empid")).toBeInTheDocument();
    expect(screen.getByTestId("login-password")).toBeInTheDocument();
    expect(screen.getByTestId("login-keep")).toBeInTheDocument();
  });
  it("renders submit button + パスワード忘れ link", () => {
    render(<GardenLoginPage />);
    expect(screen.getByTestId("login-submit")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /パスワード/ })).toHaveAttribute(
      "href",
      "/login/forgot",
    );
  });
  it("renders right-side atmosphere panel", () => {
    render(<GardenLoginPage />);
    const atm = screen.getByTestId("login-atmosphere");
    expect(atm).toBeInTheDocument();
    const style = atm.getAttribute("style") ?? "";
    expect(style).toMatch(/02-morning-calm\.webp/);
  });
  it("does NOT render excluded v2 elements", () => {
    render(<GardenLoginPage />);
    // 大見出し
    expect(screen.queryByText(/やさしく迎える業務 OS/)).toBeNull();
    // 特徴ハイライト
    expect(screen.queryByText(/透明感のある操作感/)).toBeNull();
    expect(screen.queryByText(/12 のモジュール/)).toBeNull();
    expect(screen.queryByText(/自然と Tech/)).toBeNull();
    // SSO
    expect(screen.queryByText(/SSO/)).toBeNull();
  });
});

describe("GardenLoginPage — submit flow", () => {
  it("redirects to /home (i.e., /) for staff role on success", async () => {
    signInBloomMock.mockResolvedValue({ success: true, userId: "u1" });
    fetchBloomUserMock.mockResolvedValue({ garden_role: "staff" });
    render(<GardenLoginPage />);
    fireEvent.change(screen.getByTestId("login-empid"), { target: { value: "8" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
  });
  it("redirects to /tree for closer role", async () => {
    signInBloomMock.mockResolvedValue({ success: true, userId: "u2" });
    fetchBloomUserMock.mockResolvedValue({ garden_role: "closer" });
    render(<GardenLoginPage />);
    fireEvent.change(screen.getByTestId("login-empid"), { target: { value: "9" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/tree"));
  });
  it("shows error and does not redirect on signInBloom failure", async () => {
    signInBloomMock.mockResolvedValue({ success: false, error: "wrong password" });
    render(<GardenLoginPage />);
    fireEvent.change(screen.getByTestId("login-empid"), { target: { value: "8" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
  });
});
