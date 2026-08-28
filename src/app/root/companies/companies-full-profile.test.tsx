import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  upsert: vi.fn(),
  active: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("../_lib/queries", () => ({
  fetchCompanies: mocks.fetch,
  upsertCompany: mocks.upsert,
  setCompanyActive: mocks.active,
}));
vi.mock("../_state/RootStateContext", () => ({
  useRootState: () => ({
    canWrite: true,
    rootUser: { user_id: "U1", employee_number: "0001" },
  }),
}));
vi.mock("../_lib/audit", () => ({ writeAudit: mocks.audit }));
vi.mock("../_lib/useMasterShortcuts", () => ({
  useMasterShortcuts: () => ({ activeIndex: -1 }),
}));
import CompaniesPage from "./page";
const company = {
  company_id: "COMP-001",
  company_name: "株式会社テスト",
  company_name_kana: "カブシキガイシャテスト",
  corporate_number: null,
  representative: "山田太郎",
  address: "大阪市",
  phone: null,
  default_bank: "楽天銀行",
  is_active: true,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};
describe("company full profile modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetch.mockResolvedValue([company]);
    mocks.upsert.mockResolvedValue(undefined);
    mocks.audit.mockResolvedValue(undefined);
  });
  it("saves new profile fields with number and date types intact", async () => {
    render(<CompaniesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "編集" }));
    expect(screen.getByRole("heading", { name: "基本" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "番号類" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "代表者" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "担当者" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("FAX番号"), {
      target: { value: "06-1234-5678" },
    });
    fireEvent.change(screen.getByLabelText("決算月"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("代表者生年月日"), {
      target: { value: "1980-04-05" },
    });
    fireEvent.change(screen.getByLabelText("インボイス登録番号"), {
      target: { value: "T1234567890123" },
    });
    fireEvent.change(screen.getByLabelText("担当者1 氏名"), {
      target: { value: "佐藤花子" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalled());
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        fax: "06-1234-5678",
        fiscal_end_month: 3,
        representative_birthday: "1980-04-05",
        invoice_registration_number: "T1234567890123",
        contact1_name: "佐藤花子",
      }),
    );
    expect(typeof mocks.upsert.mock.calls[0][0].fiscal_end_month).toBe(
      "number",
    );
  });
  it("offers only fiscal months 1 through 12", async () => {
    render(<CompaniesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "編集" }));
    const options = screen
      .getAllByRole("option")
      .filter((o) => /^\d+月$/.test(o.textContent ?? ""));
    expect(options.map((o) => o.getAttribute("value"))).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1)),
    );
    expect(
      options.some(
        (o) =>
          o.getAttribute("value") === "0" || o.getAttribute("value") === "13",
      ),
    ).toBe(false);
  });
});
