import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  clearBloomUnlock: vi.fn(),
  fetchBloomUser: vi.fn(),
  getSession: vi.fn(),
  markBloomUnlocked: vi.fn(),
  signOutBloom: vi.fn(),
}));

const timerMocks = vi.hoisted(() => ({
  onTimeout: undefined as (() => void) | undefined,
}));

vi.mock("../../_lib/auth", () => ({
  ...authMocks,
  hasAccess: vi.fn(() => true),
}));

vi.mock("../../_lib/session-timer", () => ({
  startSessionTimer: vi.fn((onTimeout: () => void) => {
    timerMocks.onTimeout = onTimeout;
    return vi.fn();
  }),
}));

import { BloomStateProvider } from "../BloomStateContext";

describe("BloomStateProvider timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    timerMocks.onTimeout = undefined;
    authMocks.getSession.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
    });
    authMocks.fetchBloomUser.mockResolvedValue({
      user_id: "user-1",
      employee_id: "employee-1",
      employee_number: "0001",
      name: "Test User",
      garden_role: "staff",
      birthday: null,
    });
  });

  it("locks only Bloom and does not sign out shared auth on timeout", async () => {
    render(
      <BloomStateProvider>
        <div>child</div>
      </BloomStateProvider>,
    );

    await waitFor(() => expect(timerMocks.onTimeout).toBeTypeOf("function"));
    expect(authMocks.markBloomUnlocked).toHaveBeenCalledTimes(1);

    act(() => timerMocks.onTimeout?.());

    expect(authMocks.clearBloomUnlock).toHaveBeenCalledTimes(1);
    expect(authMocks.signOutBloom).not.toHaveBeenCalled();
  });
});
