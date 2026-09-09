import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Employee } from "../_constants/types";
import PermissionsClient, { buildCsv, type PermissionMatrixRow } from "./PermissionsClient";

const mocks = vi.hoisted(() => ({
  fetchEmployees: vi.fn(),
}));

vi.mock("../_lib/queries", () => ({
  fetchEmployees: mocks.fetchEmployees,
}));

const permissionRows: PermissionMatrixRow[] = [
  {
    key: "manuals",
    label: "マニュアル",
    group: "System",
    kind: "画面",
    source: "test",
    roles: {
      toss: false,
      closer: false,
      cs: false,
      staff: true,
      outsource: true,
      manager: true,
      admin: true,
      super_admin: true,
    },
  },
  {
    key: "roster",
    label: "名簿と同期",
    group: "Root",
    kind: "操作",
    source: "test",
    roles: {
      toss: false,
      closer: false,
      cs: false,
      staff: false,
      outsource: false,
      manager: false,
      admin: true,
      super_admin: true,
    },
  },
];

const employees: Employee[] = [
  {
    employee_id: "EMP-1165",
    employee_number: "1165",
    name: "宮永 ひかり",
    name_kana: "ミヤナガヒカリ",
    company_id: "COMP-001",
    employment_type: "正社員",
    salary_system_id: "SAL-SYS-001",
    hire_date: "2026-01-01",
    termination_date: null,
    email: "hikari@example.com",
    bank_name: "",
    bank_code: "",
    branch_name: "",
    branch_code: "",
    account_type: "普通",
    account_number: "",
    account_holder: "",
    account_holder_kana: "",
    kot_employee_id: null,
    mf_employee_id: null,
    insurance_type: "加入",
    is_active: true,
    notes: null,
    created_at: "",
    updated_at: "",
    garden_role: "manager",
  },
  {
    employee_id: "EMP-1510",
    employee_number: "1510",
    name: "萩原 結那",
    name_kana: "ハギワラユナ",
    company_id: "COMP-001",
    employment_type: "アルバイト",
    salary_system_id: "SAL-SYS-001",
    hire_date: "2026-01-01",
    termination_date: null,
    email: "yuna@example.com",
    bank_name: "",
    bank_code: "",
    branch_name: "",
    branch_code: "",
    account_type: "普通",
    account_number: "",
    account_holder: "",
    account_holder_kana: "",
    kot_employee_id: null,
    mf_employee_id: null,
    insurance_type: "加入",
    is_active: true,
    notes: null,
    created_at: "",
    updated_at: "",
    garden_role: "closer",
  },
  {
    employee_id: "EMP-9999",
    employee_number: "9999",
    name: "退職 太郎",
    name_kana: "タイショクタロウ",
    company_id: "COMP-001",
    employment_type: "正社員",
    salary_system_id: "SAL-SYS-001",
    hire_date: "2026-01-01",
    termination_date: "2026-08-31",
    email: "retired@example.com",
    bank_name: "",
    bank_code: "",
    branch_name: "",
    branch_code: "",
    account_type: "普通",
    account_number: "",
    account_holder: "",
    account_holder_kana: "",
    kot_employee_id: null,
    mf_employee_id: null,
    insurance_type: "加入",
    is_active: false,
    notes: null,
    created_at: "",
    updated_at: "",
    garden_role: "staff",
  },
  {
    employee_id: "EMP-R001",
    employee_number: "R-001",
    name: "履歴 行",
    name_kana: "リレキギョウ",
    company_id: "COMP-001",
    employment_type: "正社員",
    salary_system_id: "SAL-SYS-001",
    hire_date: "2026-01-01",
    termination_date: null,
    email: "history@example.com",
    bank_name: "",
    bank_code: "",
    branch_name: "",
    branch_code: "",
    account_type: "普通",
    account_number: "",
    account_holder: "",
    account_holder_kana: "",
    kot_employee_id: null,
    mf_employee_id: null,
    insurance_type: "加入",
    is_active: true,
    notes: null,
    created_at: "",
    updated_at: "",
    garden_role: "admin",
  },
];

function renderPage() {
  return render(<PermissionsClient initialPermissionRows={permissionRows} />);
}

describe("権限一覧", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchEmployees.mockResolvedValue(employees);
  });

  it("責任者で見える権限表と従業員表を表示する", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "権限一覧" })).toBeInTheDocument();
    expect(screen.getByText("マニュアル")).toBeInTheDocument();
    expect(screen.getByText("名簿と同期")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "宮永 ひかり" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "萩原 結那" })).toBeInTheDocument();
    expect(screen.queryByText("履歴 行")).not.toBeInTheDocument();
    expect(screen.queryByText("退職 太郎")).not.toBeInTheDocument();
  });

  it("役職で絞り込み、在籍中だけの切替を反映する", async () => {
    renderPage();
    expect(await screen.findByRole("cell", { name: "宮永 ひかり" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("役職で絞る"), { target: { value: "closer" } });
    expect(screen.queryByText("宮永 ひかり")).not.toBeInTheDocument();
    expect(screen.getByText("萩原 結那")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("役職で絞る"), { target: { value: "staff" } });
    expect(screen.queryByText("退職 太郎")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("在籍中だけ"));
    expect(screen.getByText("退職 太郎")).toBeInTheDocument();
  });

  it("トスでは RootGate 側で閲覧不可にする前提の表示コンポーネントに保つ", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "権限一覧" })).toBeInTheDocument();
  });

  it("CSV は上下 2 表を BOM つきで出力できる", async () => {
    renderPage();
    await screen.findByRole("cell", { name: "宮永 ひかり" });
    const employeeTable = screen.getByRole("heading", { name: "人ごとの役職" }).parentElement?.parentElement as HTMLElement;
    expect(within(employeeTable).getAllByRole("row")).toHaveLength(3);

    const csv = buildCsv(permissionRows, [
      {
        employee_number: "1165",
        name: "宮永 ひかり",
        employment_type: "正社員",
        garden_role: "manager",
        is_active: true,
      },
      {
        employee_number: "1510",
        name: "萩原 結那",
        employment_type: "アルバイト",
        garden_role: "closer",
        is_active: true,
      },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(9);
    expect(csv).toContain("役職ごとに使える画面");
    expect(csv).toContain("人ごとの役職");
  });

  it("従業員取得に失敗したら日本語のエラーを表示する", async () => {
    mocks.fetchEmployees.mockRejectedValueOnce(new Error("従業員を読み込めませんでした"));
    renderPage();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("従業員を読み込めませんでした"));
  });
});
