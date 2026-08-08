import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/p/toss",
  replace: vi.fn(),
  getUser: vi.fn(),
  fetchPartnerOrStaff: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/app/bloom/_lib/supabase", () => ({
  supabase: { auth: { getUser: (...args: unknown[]) => mocks.getUser(...args) } },
}));

vi.mock("../_lib/auth", () => ({
  fetchPartnerOrStaff: (...args: unknown[]) => mocks.fetchPartnerOrStaff(...args),
}));

import { PartnerGate } from "./PartnerGate";

describe("PartnerGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/p/toss";
    window.history.replaceState({}, "", "/p/toss");
  });

  it("ログインページは未認証でも表示する", () => {
    mocks.pathname = "/p/login";
    render(<PartnerGate><div>LOGIN</div></PartnerGate>);
    expect(screen.getByText("LOGIN")).toBeInTheDocument();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("未認証ならreturnTo付きログインへ送る", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    render(<PartnerGate><div>PORTAL</div></PartnerGate>);
    expect(screen.queryByText("PORTAL")).toBeNull();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/p/login?returnTo=%2Fp%2Ftoss"));
  });

  it("社員アカウントを許可する", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "employee" } }, error: null });
    mocks.fetchPartnerOrStaff.mockResolvedValue({ kind: "staff" });
    render(<PartnerGate><div>PORTAL</div></PartnerGate>);
    expect(await screen.findByText("PORTAL")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("有効なトス者だけを通す", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "partner" } }, error: null });
    mocks.fetchPartnerOrStaff.mockResolvedValue({ kind: "partner", partnerCode: "1234567", partnerName: "Partner" });
    render(<PartnerGate><div>PORTAL</div></PartnerGate>);
    expect(await screen.findByText("PORTAL")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
