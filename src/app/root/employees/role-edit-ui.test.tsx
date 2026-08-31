import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canWrite: true,
  operatorRole: "super_admin" as "super_admin" | "admin" | "manager",
  fetchEmployees: vi.fn(),
  fetchCompanies: vi.fn(),
  fetchSalarySystems: vi.fn(),
  upsertEmployee: vi.fn(),
  updateEmployeeGardenRole: vi.fn(),
  setEmployeeActive: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../_lib/queries", () => ({
  fetchEmployees: mocks.fetchEmployees,
  fetchCompanies: mocks.fetchCompanies,
  fetchSalarySystems: mocks.fetchSalarySystems,
  upsertEmployee: mocks.upsertEmployee,
  updateEmployeeGardenRole: mocks.updateEmployeeGardenRole,
  setEmployeeActive: mocks.setEmployeeActive,
}));
vi.mock("../_state/RootStateContext", () => ({
  useRootState: () => ({
    canWrite: mocks.canWrite,
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
import { VALIDATION_ERROR_BANNER } from "../_lib/validators";

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
    mocks.canWrite = true;
    mocks.operatorRole = "super_admin";
    mocks.fetchEmployees.mockResolvedValue([employee]);
    mocks.fetchCompanies.mockResolvedValue([
      { company_id: "COMP-001", company_name: "株式会社テスト" },
    ]);
    mocks.fetchSalarySystems.mockResolvedValue([
      { salary_system_id: "SAL-SYS-001", system_name: "正社員標準" },
    ]);
    mocks.upsertEmployee.mockResolvedValue(undefined);
    mocks.updateEmployeeGardenRole.mockResolvedValue(undefined);
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

  describe("退職日による口座必須の切り替え", () => {
    const bankLabels = ["銀行名", "金融機関コード（4桁）", "支店名", "支店コード（3桁）", "口座番号（7桁）", "口座名義", "口座名義カナ"];
    const field = (label: string) => screen.getByLabelText(new RegExp(`^${label.replace(/[()（）]/g, "\\$&")}(?:\\*|$)`));
    const hasRequiredMark = (label: string) => field(label).closest("label")!.querySelector("span")!.textContent!.includes("*");

    it("在籍者の口座7項目の必須エラーを保持し、退職日入力時には直ちに消す", async () => {
      mocks.fetchEmployees.mockResolvedValue([employeeWithoutBank]);
      renderPage();
      await openEmployee();
      bankLabels.forEach(label => expect(hasRequiredMark(label)).toBe(true));
      fireEvent.click(screen.getByRole("button", { name: "保存" }));
      expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(7);
      expect(screen.getAllByText("必須")).toHaveLength(4);
      expect(mocks.upsertEmployee).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText("退職日"), { target: { value: "2026-06-30" } });
      bankLabels.forEach(label => expect(hasRequiredMark(label)).toBe(false));
      expect(hasRequiredMark("口座種別")).toBe(false);
      expect(screen.queryByText("必須")).not.toBeInTheDocument();
      expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
      expect(screen.queryByText(VALIDATION_ERROR_BANNER)).not.toBeInTheDocument();
      for (const label of ["従業員ID", "社員番号", "所属法人", "氏名", "氏名カナ", "メールアドレス", "雇用形態", "給与体系", "社会保険区分", "入社日"]) {
        expect(screen.getByLabelText(`${label}*`, { exact: true })).toBeInTheDocument();
      }
      mocks.fetchEmployees.mockResolvedValue([{ ...employeeWithoutBank, termination_date: "2026-06-30" }]);
      fireEvent.click(screen.getByRole("button", { name: "保存" }));
      await waitFor(() => expect(mocks.upsertEmployee).toHaveBeenCalledTimes(1));
      expect(mocks.upsertEmployee).toHaveBeenCalledWith(expect.objectContaining({
        employee_id: employee.employee_id, termination_date: "2026-06-30", is_active: true,
        bank_name: "", bank_code: "", branch_name: "", branch_code: "",
        account_number: "", account_holder: "", account_holder_kana: "",
      }));
      expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
        action: "master_update", targetId: employee.employee_id,
      }));
      expect(mocks.setEmployeeActive).not.toHaveBeenCalled();
      expect(await screen.findByRole("columnheader", { name: "退職日" })).toBeInTheDocument();
      expect(await screen.findByRole("cell", { name: "2026-06-30" })).toBeInTheDocument();
    });

    it("退職日を再び空にすると口座の必須マークと7件の検証が戻る", async () => {
      mocks.fetchEmployees.mockResolvedValue([{ ...employeeWithoutBank, termination_date: "2026-06-30" }]);
      renderPage();
      await openEmployee();
      bankLabels.forEach(label => expect(hasRequiredMark(label)).toBe(false));
      fireEvent.change(screen.getByLabelText("退職日"), { target: { value: "" } });
      bankLabels.forEach(label => expect(hasRequiredMark(label)).toBe(true));
      fireEvent.click(screen.getByRole("button", { name: "保存" }));
      expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(7);
      expect(mocks.upsertEmployee).not.toHaveBeenCalled();
    });

    it("退職日があっても入力済みの不正な口座コードはエラーを維持する", async () => {
      mocks.fetchEmployees.mockResolvedValue([{ ...employeeWithoutBank, bank_code: "123" }]);
      renderPage();
      await openEmployee();
      fireEvent.click(screen.getByRole("button", { name: "保存" }));
      fireEvent.change(screen.getByLabelText("退職日"), { target: { value: "2026-06-30" } });
      expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(1);
      expect(screen.getByText("半角数字4桁")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "保存" }));
      expect(mocks.upsertEmployee).not.toHaveBeenCalled();
    });

    it("退職日保存と無効化は従来どおり独立した操作として監査される", async () => {
      mocks.fetchEmployees.mockResolvedValue([{ ...employeeWithoutBank, termination_date: "2026-06-30" }]);
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "無効化" }));
      await waitFor(() => expect(mocks.setEmployeeActive).toHaveBeenCalledWith(employee.employee_id, false));
      expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "master_update", payload: { toggle_active: false } }));
      expect(mocks.upsertEmployee).not.toHaveBeenCalled();
    });

    it("編集権限がなければ退職者の編集・状態切り替えもできない", async () => {
      mocks.canWrite = false;
      mocks.fetchEmployees.mockResolvedValue([{ ...employeeWithoutBank, termination_date: "2026-06-30" }]);
      renderPage();
      expect(await screen.findByRole("button", { name: "編集" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "無効化" })).toBeDisabled();
      expect(mocks.upsertEmployee).not.toHaveBeenCalled();
    });
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

    it("口座が空でも専用の更新経路でemployee_idとgarden_roleを渡して一覧へ即時反映する", async () => {
      mocks.fetchEmployees.mockResolvedValue([employeeWithoutBank]);
      renderPage();
      const select = await openRoleDialog();
      fireEvent.change(select, { target: { value: "closer" } });
      fireEvent.click(screen.getByRole("button", { name: "変更する" }));

      await waitFor(() => expect(mocks.updateEmployeeGardenRole).toHaveBeenCalledTimes(1));
      expect(mocks.updateEmployeeGardenRole).toHaveBeenCalledWith("EMP-1404", "closer");
      expect(mocks.upsertEmployee).not.toHaveBeenCalled();
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
      expect(mocks.updateEmployeeGardenRole).not.toHaveBeenCalled();
    });

    it("権限変更をDBに拒否されたときは開発者向け文字列を表示しない", async () => {
      mocks.fetchEmployees.mockResolvedValue([employeeWithoutBank]);
      mocks.updateEmployeeGardenRole.mockRejectedValueOnce(
        new Error("updateEmployeeGardenRole failed: P0001 enforce_garden_role_change upsertEmployee employee_number not-null constraint"),
      );
      vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
      renderPage();
      const select = await openRoleDialog();
      fireEvent.change(select, { target: { value: "closer" } });
      fireEvent.click(screen.getByRole("button", { name: "変更する" }));

      expect(
        await screen.findByText(
          "Garden権限を変更できませんでした。全権管理者のアカウントで操作してください。",
        ),
      ).toBeInTheDocument();
      for (const developerText of ["upsertEmployee", "employee_number", "not-null", "P0001"]) {
        expect(screen.queryByText(new RegExp(developerText))).not.toBeInTheDocument();
      }
    });

    it("その他の更新失敗も再試行を促す日本語だけを表示する", async () => {
      mocks.updateEmployeeGardenRole.mockRejectedValueOnce(
        new Error("updateEmployeeGardenRole failed: employee_number not-null constraint"),
      );
      vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
      renderPage();
      const select = await openRoleDialog();
      fireEvent.change(select, { target: { value: "closer" } });
      fireEvent.click(screen.getByRole("button", { name: "変更する" }));

      expect(
        await screen.findByText(
          "Garden権限を変更できませんでした。時間をおいて、もう一度お試しください。",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/employee_number|not-null|updateEmployeeGardenRole/)).not.toBeInTheDocument();
    });
  });
});
