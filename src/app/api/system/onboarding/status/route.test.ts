import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));

import { GET } from "./route";

function client(options: {
  user?: boolean;
  employee?: { employee_id?: unknown } | null;
  onboarding?: { status?: string; my_number?: string; name?: string } | null;
  employeeError?: unknown;
  onboardingError?: unknown;
} = {}) {
  const calls: unknown[][] = [];
  const selects: string[] = [];
  const employeeQuery = {
    select(value: string) { selects.push(value); return this; },
    eq(...args: unknown[]) { calls.push(args); return this; },
    is(...args: unknown[]) { calls.push(args); return this; },
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.employee === undefined ? { employee_id: "EMP-0001" } : options.employee,
      error: options.employeeError ?? null,
    }),
  };
  const onboardingQuery = {
    select(value: string) { selects.push(value); return this; },
    eq(...args: unknown[]) { calls.push(args); return this; },
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.onboarding === undefined ? null : options.onboarding,
      error: options.onboardingError ?? null,
    }),
  };
  return {
    calls,
    selects,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === false ? null : { id: "logged-in-user" } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => table === "root_employees" ? employeeQuery : onboardingQuery),
  };
}

describe("GET /api/system/onboarding/status", () => {
  beforeEach(() => mocks.createServerClient.mockReset());

  it.each([
    [null, true],
    [{ status: "draft" }, true],
    [{ status: "submitted" }, false],
  ])("returns only whether the logged-in employee needs onboarding: %o", async (onboarding, needsOnboarding) => {
    const db = client({ onboarding }); mocks.createServerClient.mockResolvedValue(db);
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ needsOnboarding });
    expect(db.calls).toContainEqual(["user_id", "logged-in-user"]);
    expect(db.calls).toContainEqual(["employee_id", "EMP-0001"]);
    expect(db.selects).toEqual(["employee_id", "status"]);
  });

  it("does not return onboarding input values even if the row includes them", async () => {
    mocks.createServerClient.mockResolvedValue(client({ onboarding: { status: "draft", my_number: "123456789012", name: "秘密" } }));
    const payload = await (await GET()).json();

    expect(payload).toEqual({ needsOnboarding: true });
    expect(JSON.stringify(payload)).not.toMatch(/123456789012|秘密|my_number|name/);
  });

  it("returns false for non-employees and unauthenticated users", async () => {
    mocks.createServerClient.mockResolvedValue(client({ employee: null }));
    expect(await (await GET()).json()).toEqual({ needsOnboarding: false });
    mocks.createServerClient.mockResolvedValue(client({ user: false }));
    expect(await (await GET()).json()).toEqual({ needsOnboarding: false });
  });

  it("returns false when tables are missing or database lookups fail", async () => {
    mocks.createServerClient.mockResolvedValue(client({ onboardingError: { code: "42P01", message: "missing table" } }));
    expect(await (await GET()).json()).toEqual({ needsOnboarding: false });
    mocks.createServerClient.mockResolvedValue(client({ employeeError: { message: "private detail" } }));
    expect(await (await GET()).json()).toEqual({ needsOnboarding: false });
  });
});
