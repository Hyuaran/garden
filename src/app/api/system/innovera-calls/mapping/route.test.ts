import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/innovera/calls.server", () => ({
  requireCallAccess: vi.fn(async () => ({
    supabase: {},
    employeeId: "EMP-admin",
    employeeName: "Admin",
    role: "admin",
    access: "all",
    ownExtension: null,
    ownExtensions: [],
  })),
  callAccessErrorResponse: vi.fn((error) => { throw error; }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(async () => ({
            data: [
              { employee_id: "EMP-1", name: "Agent", innovera_extension: "2040", innovera_mobile_extension: "1003" },
              { employee_id: "EMP-2", name: "No Mobile User", innovera_extension: "2050", innovera_mobile_extension: null },
              { employee_id: "EMP-3", name: "Missing", innovera_extension: null, innovera_mobile_extension: null },
              { employee_id: "EMP-4", name: "Bad Mobile", innovera_extension: "2060", innovera_mobile_extension: "9999" },
            ],
          })),
        })),
      })),
    })),
  }),
}));

vi.mock("@/lib/innovera/client", () => ({
  listInnoveraUsers: vi.fn(async () => [
    { id: "u1", name: "Agent PC", number: "2040" },
    { id: "u2", name: "Agent Mobile", number: "1003" },
    { id: "u3", name: "No Mobile User", number: "2050" },
    { id: "u4", name: "Bad Mobile PC", number: "2060" },
    { id: "u5", name: "Unmapped", number: "3000" },
  ]),
}));

describe("innovera calls mapping route", () => {
  it("matches employees by both PC and mobile extensions", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.mapped.map((row: { user: { number: string }; employee: { employee_id: string } }) => [row.user.number, row.employee.employee_id])).toEqual([
      ["2040", "EMP-1"],
      ["1003", "EMP-1"],
      ["2050", "EMP-2"],
      ["2060", "EMP-4"],
    ]);
    expect(body.unmappedEmployees.map((employee: { employee_id: string }) => employee.employee_id)).toEqual(["EMP-3", "EMP-4"]);
    expect(body.unmappedUsers.map((user: { number: string }) => user.number)).toEqual(["3000"]);
  });
});
