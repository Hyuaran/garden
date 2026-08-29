import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  clearForestUnlock: vi.fn(),
  getSession: vi.fn(),
  markForestUnlocked: vi.fn(),
  signOutForest: vi.fn(),
}));
const queryMocks = vi.hoisted(() => ({
  fetchCompanies: vi.fn(),
  fetchFiscalPeriods: vi.fn(),
  fetchForestUser: vi.fn(),
  fetchLastUpdated: vi.fn(),
  fetchShinkouki: vi.fn(),
}));
const auditMocks = vi.hoisted(() => ({ writeAuditLog: vi.fn() }));
const timerMocks = vi.hoisted(() => ({
  onTimeout: undefined as (() => void) | undefined,
}));

vi.mock("../_lib/auth", () => authMocks);
vi.mock("../_lib/queries", () => queryMocks);
vi.mock("../_lib/audit", () => auditMocks);
vi.mock("../_lib/session-timer", () => ({
  startSessionTimer: vi.fn((onTimeout: () => void) => {
    timerMocks.onTimeout = onTimeout;
    return vi.fn();
  }),
}));

import { ForestStateProvider } from "./ForestStateContext";

describe("ForestStateProvider timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    timerMocks.onTimeout = undefined;
    authMocks.getSession.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
    });
    queryMocks.fetchForestUser.mockResolvedValue({
      user_id: "user-1",
      employee_number: "0001",
      role: "admin",
      approved_by: null,
      approved_at: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    queryMocks.fetchCompanies.mockResolvedValue([]);
    queryMocks.fetchFiscalPeriods.mockResolvedValue([]);
    queryMocks.fetchShinkouki.mockResolvedValue([]);
    queryMocks.fetchLastUpdated.mockResolvedValue(null);
    auditMocks.writeAuditLog.mockResolvedValue(undefined);
    authMocks.signOutForest.mockResolvedValue(undefined);
  });

  it("timeoutではForestだけをロックして共有認証を終了しない", async () => {
    render(<ForestStateProvider><div>child</div></ForestStateProvider>);
    await waitFor(() => expect(timerMocks.onTimeout).toBeTypeOf("function"));

    await act(async () => timerMocks.onTimeout?.());

    expect(authMocks.clearForestUnlock).toHaveBeenCalledTimes(1);
    expect(authMocks.signOutForest).not.toHaveBeenCalled();
    expect(auditMocks.writeAuditLog).toHaveBeenCalledWith("logout_timeout");
  });
});
