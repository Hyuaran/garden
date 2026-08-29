import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  clearRootUnlock: vi.fn(),
  getSession: vi.fn(),
  getSessionElapsedMs: vi.fn(() => 0),
  isRootUnlocked: vi.fn(() => true),
  markRootUnlocked: vi.fn(),
  signOutRoot: vi.fn(),
  touchRootSession: vi.fn(),
}));
const queryMocks = vi.hoisted(() => ({ fetchRootUser: vi.fn() }));
const auditMocks = vi.hoisted(() => ({ writeAudit: vi.fn() }));

vi.mock("../_lib/auth", () => authMocks);
vi.mock("../_lib/queries", () => queryMocks);
vi.mock("../_lib/audit", () => auditMocks);
vi.mock("../_lib/session-timer", () => ({
  SESSION_TIMEOUT_MS: 300_000,
  WARNING_OFFSET_MS: 60_000,
  TIMER_POLL_INTERVAL_MS: 1_000,
}));

import { RootStateProvider, useRootState } from "./RootStateContext";

function Controls() {
  const { isAuthenticated, signOut } = useRootState();
  return (
    <div>
      <span>{isAuthenticated ? "認証済み" : "Rootロック中"}</span>
      <button onClick={() => void signOut("timeout")}>timeout</button>
      <button onClick={() => void signOut("manual")}>manual</button>
    </div>
  );
}

describe("RootStateProvider logout reasons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    queryMocks.fetchRootUser.mockResolvedValue({
      employee_id: "EMP-0001",
      employee_number: "0001",
      name: "テスト利用者",
      email: "user@example.com",
      garden_role: "super_admin",
      company_id: "COMP-001",
      is_active: true,
      user_id: "user-1",
    });
    auditMocks.writeAudit.mockResolvedValue(undefined);
    authMocks.signOutRoot.mockResolvedValue(undefined);
  });

  it("timeoutでは監査を残してRootだけをロックする", async () => {
    render(
      <RootStateProvider>
        <Controls />
      </RootStateProvider>,
    );
    expect(await screen.findByText("認証済み")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "timeout" }));

    expect(await screen.findByText("Rootロック中")).toBeInTheDocument();
    expect(authMocks.clearRootUnlock).toHaveBeenCalledTimes(1);
    expect(authMocks.signOutRoot).not.toHaveBeenCalled();
    expect(auditMocks.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "logout", payload: { reason: "timeout" } }),
    );
  });

  it("manualではRootロック後に共有認証も終了する", async () => {
    let finishAudit: (() => void) | undefined;
    auditMocks.writeAudit.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishAudit = resolve; }),
    );
    render(
      <RootStateProvider>
        <Controls />
      </RootStateProvider>,
    );
    expect(await screen.findByText("認証済み")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "manual" }));

    await waitFor(() => expect(authMocks.signOutRoot).toHaveBeenCalledTimes(1));
    expect(authMocks.clearRootUnlock).toHaveBeenCalledTimes(1);
    expect(auditMocks.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "logout", payload: { reason: "manual" } }),
    );
    await act(async () => finishAudit?.());
  });
});
