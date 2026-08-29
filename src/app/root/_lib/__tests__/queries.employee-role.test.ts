import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabase: { from: mocks.from },
}));

import { updateEmployeeGardenRole } from "../queries";

describe("updateEmployeeGardenRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({
      update: mocks.update,
      upsert: mocks.upsert,
    });
  });

  it("garden_roleだけをUPDATEし、employee_idで対象行を限定する", async () => {
    await updateEmployeeGardenRole("EMP-1404", "closer");

    expect(mocks.from).toHaveBeenCalledWith("root_employees");
    expect(mocks.update).toHaveBeenCalledWith({ garden_role: "closer" });
    expect(Object.keys(mocks.update.mock.calls[0][0])).toEqual(["garden_role"]);
    expect(mocks.eq).toHaveBeenCalledWith("employee_id", "EMP-1404");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
