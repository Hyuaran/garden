import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  operatorRole: "super_admin" as "super_admin" | "admin" | "manager",
  fetchEmployees: vi.fn(),
  fetchCompanies: vi.fn(),
  fetchSalarySystems: vi.fn(),
  upsertEmployee: vi.fn(),
  setEmployeeActive: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../_lib/queries", () => ({
  fetchEmployees: mocks.fetchEmployees,
  fetchCompanies: mocks.fetchCompanies,
  fetchSalarySystems: mocks.fetchSalarySystems,
  upsertEmployee: mocks.upsertEmployee,
  setEmployeeActive: mocks.setEmployeeActive,
}));
vi.mock("../_state/RootStateContext", () => ({
  useRootState: () => ({
    canWrite: true,
    rootUser: {
      user_id: "USER-001",
      employee_number: "0001",
      garden_role: mocks.operatorRole,
    },
  }),
}));
vi.mock("../_lib/audit", () => ({ writeAudit: mocks.audit }));
vi.mock("../_lib/useMasterShortcuts", () => ({
  useMasterShortcuts: () => ({ activeIndex: -1 }),
}));

import EmployeesPage from "./page";
import { GardenRoleField } from "./GardenRoleField";

const employee = {
  employee_id: "EMP-1404",
  employee_number: "1404",
  name: "毛利テスト",
  name_kana: "モウリテスト",
  company_id: "COMP-001",
  employment_type: "正社員",
  salary_system_id: "SAL-SYS-001",
  hire_date: "2026-01-01",
  termination_date: null,
  contract_end_on: null,
  kou_otsu: null,
  dependents_count: 0,
  deleted_at: null,
  email: "mouri@example.com",
  bank_name: "テスト銀行",
  bank_code: "1234",
  branch_name: "本店",
  branch_code: "123",
  account_type: "普通",
  account_number: "1234567",
  account_holder: "毛利テスト",
  account_holder_kana: "モウリテスト",
  kot_employee_id: null,
  mf_employee_id: null,
  insurance_type: "加入",
  is_active: true,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  garden_role: "staff" as const,
};

const employeeWithoutBank = {
  ...employee,
  bank_name: "",
  bank_code: "",
  branch_name: "",
  branch_code: "",
  account_number: "",
  account_holder: "",
  account_holder_kana: "",
};

function renderPage() {
  return render(<EmployeesPage />);
}

async function openEmployee() {
  fireEvent.click(await screen.findByRole("button", { name: "編集" }));
  return screen.getByLabelText("Garden権限") as HTMLSelectElement;
}

async function openRoleDialog() {
  fireEvent.click(await screen.findByRole("button", { name: "権限" }));
  return screen.getByLabelText("変更後") as HTMLSelectElement;
}

describe("Garden権限の編集UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operatorRole = "super_admin";
    mocks.fetchEmployees.mockResolvedValue([employee]);
    mocks.fetchCompanies.mockResolvedValue([
      { company_id: "COMP-001", company_name: "株式会社テスト" },
    ]);
    mocks.fetchSalarySystems.mockResolvedValue([
      { salary_system_id: "SAL-SYS-001", system_name: "正社員標準" },
    ]);
    mocks.upsertEmployee.mockResolvedValue(undefined);
    mocks.audit.mockResolvedValue(undefined);
  });

  it("全権管理者には指定順の日本語選択肢だけを編集可能で表示する", () => {
    render(
      <GardenRoleField
        operatorRole="super_admin"
        value="staff"
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("Garden権限") as HTMLSelectElement;
    expect(select).toBeEnabled();
    expect(Array.from(select.options, (option) => option.text)).toEqual([
      "管理者",
      "マネージャー",
      "正社員",
      "CS",
      "クローザー",
      "トス",
      "業務委託",
    ]);
    expect(Array.from(select.options, (option) => option.value)).not.toContain("super_admin");
    expect(screen.queryByText("closer")).not.toBeInTheDocument();
  });

  it.each(["admin", "manager"] as const)(
    "%s には変更理由を示して選択欄を無効化する",
    (operatorRole) => {
      render(
        <GardenRoleField
          operatorRole={operatorRole}
          value="staff"
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByLabelText("Garden権限")).toBeDisabled();
      expect(screen.getByLabelText("Garden権限")).toHaveAttribute(
        "title",
        "Garden権限の変更は全権管理者のみ行えます",
      );
    },
  );

  it("一覧に日本語のGarden権限を表示する", async () => {
    renderPage();
    expect(await screen.findByRole("columnheader", { name: "Garden権限" })).toBeInTheDocument();
    expect(screen.getAllByText("正社員")).toHaveLength(2);
  });

  it("変更したgarden_roleを既存の保存経路へ含める", async () => {
    renderPage();
    const select = await openEmployee();
    expect(select).toHaveValue("staff");
    fireEvent.change(select, { target: { value: "closer" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mocks.upsertEmployee).toHaveBeenCalledTimes(1));
    expect(mocks.upsertEmployee).toHaveBeenCalledWith(
      expect.objectContaining({ employee_id: "EMP-1404", garden_role: "closer" }),
    );
  });

  it("DB拒否時は開発者向け文字列を伏せて操作方法を表示する", async () => {
    mocks.upsertEmployee.mockRejectedValueOnce(
      new Error("upsertEmployee failed: P0001 enforce_garden_role_change: 現在の権限=(未認証)"),
    );
    renderPage();
    const select = await openEmployee();
    fireEvent.change(select, { target: { value: "closer" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(
      await screen.findByText(
        "Garden権限を変更できませんでした。全権管理者のアカウントで操作してください。",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/P0001/)).not.toBeInTheDocument();
    expect(screen.queryByText(/enforce_garden_role_change/)).not.toBeInTheDocument();
  });

  describe("権限だけを変更するダイアログ", () => {
    it("全権管理者には権限ボタンを有効にする", async () => {
      renderPage();
      expect(await screen.findByRole("button", { name: "権限" })).toBeEnabled();
    });

    it.each(["admin", "manager"] as const)(
      "%s には権限ボタンを無効化して理由を示す",
      async (operatorRole) => {
        mocks.operatorRole = operatorRole;
        renderPage();
        const button = await screen.findByRole("button", { name: "権限" });
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute(
          "title",
          "Garden権限の変更は全権管理者のみ行えます",
        );
      },
    );

    it("氏名と権限だけを表示し、従業員の他項目を表示しない", async () => {
      renderPage();
      await openRoleDialog();
      const heading = screen.getByRole("heading", { name: "Garden権限の変更" });
      const panel = heading.parentElement?.parentElement as HTMLElement;
      const dialog = within(panel);

      expect(dialog.getByText("毛利テスト（社員番号 1404）")).toBeInTheDocument();
      expect(dialog.getByText("いまの権限")).toBeInTheDocument();
      expect(dialog.getAllByText("正社員")).toHaveLength(2);
      expect(dialog.queryByLabelText("銀行名")).not.toBeInTheDocument();
      expect(dialog.queryByLabelText("給与体系*")).not.toBeInTheDocument();
      expect(dialog.queryByLabelText("入社日*")).not.toBeInTheDocument();
    });

    it("口座が空でもemployee_idとgarden_roleだけを送って一覧へ即時反映する", async () => {
      mocks.fetchEmployees.mockResolvedValue([employeeWithoutBank]);
      renderPage();
      const select = await openRoleDialog();
      fireEvent.change(select, { target: { value: "closer" } });
      fireEvent.click(screen.getByRole("button", { name: "変更する" }));

      await waitFor(() => expect(mocks.upsertEmployee).toHaveBeenCalledTimes(1));
      const payload = mocks.upsertEmployee.mock.calls[0][0];
      expect(payload).toEqual({ employee_id: "EMP-1404", garden_role: "closer" });
      expect(Object.keys(payload)).toEqual(["employee_id", "garden_role"]);
      expect(await screen.findByText("クローザー")).toBeInTheDocument();
    });

    it("現在と同じ権限なら更新せず閉じる", async () => {
      renderPage();
      const select = await openRoleDialog();
      expect(select).toHaveValue("staff");
      fireEvent.click(screen.getByRole("button", { name: "変更する" }));

      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Garden権限の変更" })).not.toBeInTheDocument();
      });
      expect(mocks.upsertEmployee).not.toHaveBeenCalled();
    });

    it("DB拒否時は開発者向け文字列を表示しない", async () => {
      mocks.fetchEmployees.mockResolvedValue([employeeWithoutBank]);
      mocks.upsertEmployee.mockRejectedValueOnce(
        new Error("upsertEmployee failed: P0001 enforce_garden_role_change"),
      );
      renderPage();
      const select = await openRoleDialog();
      fireEvent.change(select, { target: { value: "closer" } });
      fireEvent.click(screen.getByRole("button", { name: "変更する" }));

      expect(
        await screen.findByText(
          "Garden権限を変更できませんでした。全権管理者のアカウントで操作してください。",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/P0001/)).not.toBeInTheDocument();
      expect(screen.queryByText(/enforce_garden_role_change/)).not.toBeInTheDocument();
    });
  });
});
