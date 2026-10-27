import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabase: { from: mocks.from },
}));

vi.mock("../read-data", () => ({ readRootData: vi.fn(async () => []) }));
import { readRootData } from "../read-data";
import { ROOT_EMPLOYEE_SELECT_FIELDS } from "../employee-select";
import { fetchEmployees, updateEmployeeGardenRole } from "../queries";

describe("updateEmployeeGardenRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const orderedQuery = { data: [], error: null, order: mocks.order };
    mocks.order.mockReturnValue(orderedQuery);
    mocks.select.mockReturnValue({ order: mocks.order });
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({
      select: mocks.select,
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

  it("fetchEmployees selects INNOVERA and call recording fields", async () => {
    await fetchEmployees();

    expect(readRootData).toHaveBeenCalledWith("employees", "root-employees");
    expect(ROOT_EMPLOYEE_SELECT_FIELDS).toContain("innovera_extension");
    expect(ROOT_EMPLOYEE_SELECT_FIELDS).toContain("chatwork_account_id");
    expect(ROOT_EMPLOYEE_SELECT_FIELDS).toContain("call_recording_access");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
