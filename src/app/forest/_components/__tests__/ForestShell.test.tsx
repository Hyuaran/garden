/**
 * T-F2-01: ForestShell ヘッダーに update-info（最終更新日）を表示する UI のテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f2-01-last-updated.md §5 Step 4, §7
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type Mock,
} from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/app/forest/_state/ForestStateContext", () => ({
  useForestState: vi.fn(),
}));

import { ForestShell } from "@/app/forest/_components/ForestShell";
import { useForestState } from "@/app/forest/_state/ForestStateContext";
import { usePathname } from "next/navigation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setForestState(partial: any) {
  (useForestState as unknown as Mock).mockReturnValue({
    loading: false,
    isAuthenticated: true,
    hasPermission: true,
    isUnlocked: true,
    userEmail: "test@example.com",
    forestUser: null,
    companies: [],
    periods: [],
    shinkouki: [],
    lastUpdated: null,
    taxFiles: [],
    unlock: vi.fn(),
    lockAndLogout: vi.fn(),
    refreshData: vi.fn(),
    refreshAuth: vi.fn(),
    ...partial,
  });
}

describe("ForestShell - update-info (T-F2-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (usePathname as unknown as Mock).mockReturnValue("/forest/dashboard");
  });

  it("renders `最終更新: YYYY年M月D日` when lastUpdated has a value", () => {
    setForestState({
      lastUpdated: {
        source: "fiscal_periods",
        at: new Date(2026, 3, 25),
      },
    });

    render(<ForestShell>child</ForestShell>);

    expect(
      screen.getByText(/最終更新: 2026年4月25日/),
    ).toBeInTheDocument();
  });

  it("renders `最終更新: ―` when lastUpdated is null", () => {
    setForestState({ lastUpdated: null });

    render(<ForestShell>child</ForestShell>);

    expect(screen.getByText(/最終更新: ―/)).toBeInTheDocument();
  });

  it("does not render update-info on the login page", () => {
    setForestState({
      isUnlocked: false,
      lastUpdated: { source: "fiscal_periods", at: new Date(2026, 3, 25) },
    });
    (usePathname as unknown as Mock).mockReturnValue("/forest/login");

    render(<ForestShell>child</ForestShell>);

    expect(screen.queryByText(/最終更新/)).not.toBeInTheDocument();
  });
});
