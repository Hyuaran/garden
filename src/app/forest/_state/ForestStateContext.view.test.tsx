import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ member: null as null | { role: string }, configured: false, legacyEntryAllowed: true, direct: vi.fn() }));
vi.mock("../_lib/auth", () => ({
  clearForestUnlock: vi.fn(), markForestUnlocked: vi.fn(), signOutForest: vi.fn(),
  getSession: async () => ({ user: { id: "user", email: "example@test" } }),
}));
vi.mock("../_lib/queries", () => ({
  fetchForestUser: async () => mocks.member,
  fetchCompanies: mocks.direct, fetchFiscalPeriods: mocks.direct, fetchLastUpdated: mocks.direct, fetchShinkouki: mocks.direct,
}));
vi.mock("../_lib/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../_lib/session-timer", () => ({ startSessionTimer: () => () => {} }));
import { ForestStateProvider, useForestState } from "./ForestStateContext";
function Probe() {
  const state = useForestState();
  return <div>{state.loading ? "loading" : state.isUnlocked ? `open:${state.forestUser?.role ?? "read-only"}` : "locked"}</div>;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.member = null; mocks.configured = false; mocks.legacyEntryAllowed = true;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.includes("kind=access") ? { configured: mocks.configured, legacyEntryAllowed: mocks.legacyEntryAllowed } : { companies: [], periods: [], shinkouki: [] },
  })));
});
afterEach(() => vi.unstubAllGlobals());
describe("Forest scoped read access keeps the legacy write gate", () => {
  it("does not unlock an unregistered user without a setting", async () => {
    render(<ForestStateProvider readPage="forest-dashboard"><Probe /></ForestStateProvider>);
    await screen.findByText("locked"); expect(mocks.direct).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("unlocks an explicitly added viewer using the checked reader, without an admin role", async () => {
    mocks.configured = true;
    render(<ForestStateProvider readPage="forest-dashboard"><Probe /></ForestStateProvider>);
    await screen.findByText("open:read-only");
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/forest/view?page=forest-dashboard", { cache: "no-store" }));
    expect(mocks.direct).not.toHaveBeenCalled();
  });
  it("does not expose editor controls to a newly admitted role with an old Forest admin row", async () => {
    mocks.member = { role: "admin" }; mocks.configured = true; mocks.legacyEntryAllowed = false;
    render(<ForestStateProvider readPage="forest-shinkouki"><Probe /></ForestStateProvider>);
    await screen.findByText("open:viewer"); expect(mocks.direct).not.toHaveBeenCalled();
  });
});
