import { it, expect, vi } from "vitest";
vi.mock("@/lib/auth/system-view-api.server", () => ({
  requireViewEmployee: vi.fn(async () => null),
}));
vi.mock("@/lib/line/liff-verify.server", () => ({
  verifyLiffEmployee: vi.fn(),
}));
vi.mock("@/lib/shift/service.server", () => ({
  myShift: vi.fn(),
  teamShift: vi.fn(),
  ShiftError: class extends Error {
    status = 400;
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));
import { shiftRoute } from "./route.server";
import { requireViewEmployee } from "@/lib/auth/system-view-api.server";
it("route case 1", async () => {
  for (const action of [
    "my",
    "read",
    "person",
    "holiday",
    "confirm",
    "remind",
    "kot",
  ]) {
    const r = await shiftRoute(
      new Request("http://localhost/api?month=2026-12"),
      action,
    );
    expect(r.status).toBe(403);
    expect(requireViewEmployee).toHaveBeenLastCalledWith(
      "system-shift",
      action === "my" ? "mine" : "team",
      action === "my" ? "employee" : "manager",
    );
  }
});
