import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/toss",
  replace: vi.fn(),
  getUser: vi.fn(),
  fetchTossPartner: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/app/bloom/_lib/supabase", () => ({
  supabase: { auth: { getUser: (...args: unknown[]) => mocks.getUser(...args) } },
}));

vi.mock("../../_lib/auth", () => ({
  fetchTossPartner: (...args: unknown[]) => mocks.fetchTossPartner(...args),
}));

import { TossGate } from "../TossGate";

describe("TossGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/toss";
    window.history.replaceState({}, "", "/toss");
  });

  it("ログインページは未認証でも表示する", () => {
    mocks.pathname = "/toss/login";
    render(<TossGate><div>LOGIN</div></TossGate>);
    expect(screen.getByText("LOGIN")).toBeInTheDocument();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("未認証ならreturnTo付きログインへ送る", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    render(<TossGate><div>PORTAL</div></TossGate>);
    expect(screen.queryByText("PORTAL")).toBeNull();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/toss/login?returnTo=%2Ftoss"));
  });

  it("toss_partnersにいない社員アカウントを拒否する", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "employee" } }, error: null });
    mocks.fetchTossPartner.mockResolvedValue(null);
    render(<TossGate><div>PORTAL</div></TossGate>);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/toss/login"));
    expect(screen.queryByText("PORTAL")).toBeNull();
  });

  it("有効なトス者だけを通す", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "partner" } }, error: null });
    mocks.fetchTossPartner.mockResolvedValue({ partner_code: "1234567", partner_name: "Partner", is_active: true });
    render(<TossGate><div>PORTAL</div></TossGate>);
    expect(await screen.findByText("PORTAL")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
