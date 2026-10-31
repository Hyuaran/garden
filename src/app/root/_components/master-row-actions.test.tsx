import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ writable: true, toggle: vi.fn() }));
vi.mock("../_state/RootStateContext", () => ({ useRootState: () => ({ canWrite: m.writable, rootUser: null }) }));
vi.mock("../_lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("../_lib/useMasterShortcuts", () => ({ useMasterShortcuts: () => ({ activeIndex: -1 }) }));
vi.mock("../_lib/queries", () => ({
  fetchCompanies: async () => [],
  fetchVendors: async () => [{ vendor_id: "VND-001", vendor_name: "取引先", vendor_name_kana: "トリヒキサキ", is_active: true, created_at: "2026-01-01" }],
  fetchInsurance: async () => [{ insurance_id: "INS-001", fiscal_year: "2026", is_active: true, created_at: "2026-01-01" }],
  fetchSalarySystems: async () => [{ salary_system_id: "SAL-001", system_name: "給与体系", is_active: true, created_at: "2026-01-01" }],
  fetchAttendance: async () => [{ attendance_id: "ATT-001", employee_id: "EMP-001", target_month: "2026-10", created_at: "2026-01-01" }],
  fetchEmployees: async () => [{ employee_id: "EMP-001", name: "従業員" }],
  setVendorActive: m.toggle, setInsuranceActive: m.toggle, setSalarySystemActive: m.toggle,
  upsertVendor: vi.fn(), upsertInsurance: vi.fn(), upsertSalarySystem: vi.fn(), upsertAttendance: vi.fn(),
}));
import Vendors from "../vendors/page";
import Insurance from "../insurance/page";
import SalarySystems from "../salary-systems/page";
import Attendance from "../attendance/page";

beforeEach(() => { m.writable = true; m.toggle.mockReset(); });
it.each([
  [Vendors, "VND-001", "取引先を編集"],
  [Insurance, "INS-001", "保険料率を編集"],
  [SalarySystems, "SAL-001", "給与体系を編集"],
] as const)("%s は行から編集を開き、小窓で無効化を確認する", async (Page, id, title) => {
  render(<Page />);
  const row = (await screen.findByText(id)).closest("tr")!;
  expect(row.querySelector("button")).toBeNull();
  expect(screen.queryByRole("columnheader", { name: "操作" })).not.toBeInTheDocument();
  fireEvent.keyDown(row, { key: "Enter" });
  const editor = screen.getByRole("dialog", { name: title });
  fireEvent.click(within(editor).getByRole("button", { name: "無効化" }));
  expect(m.toggle).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("dialog", { name: "無効化の確認" })).getByRole("button", { name: "無効化" }));
  await waitFor(() => expect(m.toggle).toHaveBeenCalledWith(id, false));
});
it("勤怠の行は Space で編集を開く", async () => {
  render(<Attendance />);
  const row = (await screen.findByText("ATT-001")).closest("tr")!;
  expect(row.querySelector("button")).toBeNull();
  fireEvent.keyDown(row, { key: " " });
  expect(screen.getByRole("dialog", { name: "勤怠データを編集" })).toBeInTheDocument();
});
it("閲覧者は取引先の行から編集できない", async () => {
  m.writable = false;
  render(<Vendors />);
  fireEvent.click((await screen.findByText("VND-001")).closest("tr")!);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
