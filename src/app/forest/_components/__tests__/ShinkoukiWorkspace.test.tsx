import { fireEvent, render, screen } from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import { ShinkoukiWorkspace } from "../ShinkoukiWorkspace";
import { useForestState } from "../../_state/ForestStateContext";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("../../_state/ForestStateContext", () => ({
  useForestState: vi.fn(),
}));

vi.mock("../NumberUpdateForm", () => ({
  NumberUpdateForm: ({ companyId }: { companyId: string }) => (
    <div data-testid="number-form">{companyId}</div>
  ),
}));

vi.mock("../PeriodRolloverForm", () => ({
  PeriodRolloverForm: ({ companyId }: { companyId: string }) => (
    <div data-testid="rollover-form">{companyId}</div>
  ),
}));

const baseCompany = {
  id: "hualang",
  name: "Hualang",
  short: "HUA",
  kessan: "3月",
  color: "#2d6a4f",
  light: "#d8f3dc",
  sort_order: 1,
};

const baseShinkouki = {
  company_id: "hualang",
  ki: 12,
  yr: 2026,
  label: "第12期",
  range: "2026-04-01~2027-03-31",
  reflected: "2026/5まで反映中",
  zantei: true,
  uriage: 1000,
  gaichuhi: 300,
  rieki: 700,
};

function mockForestState(role: "admin" | "viewer" = "admin") {
  (useForestState as unknown as Mock).mockReturnValue({
    loading: false,
    isAuthenticated: true,
    hasPermission: true,
    isUnlocked: true,
    userEmail: "forest@example.com",
    forestUser: {
      user_id: "u1",
      employee_number: "0001",
      role,
      approved_by: null,
      approved_at: null,
      created_at: "2026-01-01",
    },
    companies: [baseCompany],
    periods: [],
    shinkouki: [baseShinkouki],
    lastUpdated: null,
    unlock: vi.fn(),
    lockAndLogout: vi.fn(),
    refreshData: vi.fn(),
    refreshAuth: vi.fn(),
  });
}

describe("ShinkoukiWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders overview cards and links to the company page", () => {
    mockForestState("admin");

    render(<ShinkoukiWorkspace mode="overview" />);

    expect(screen.getByText("進行期の更新")).toBeInTheDocument();
    expect(screen.getByText("HUA")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "この法人だけ詳しく見る / 編集" }))
      .toHaveAttribute("href", "/forest/shinkouki/hualang");
    expect(screen.getByTestId("number-form")).toHaveTextContent("hualang");
  });

  it("switches the editor tab for admin users", () => {
    mockForestState("admin");

    render(<ShinkoukiWorkspace mode="detail" companyId="hualang" />);
    fireEvent.click(screen.getByRole("button", { name: "期の切り替え" }));

    expect(screen.getByTestId("rollover-form")).toHaveTextContent("hualang");
  });

  it("keeps viewer users read-only", () => {
    mockForestState("viewer");

    render(<ShinkoukiWorkspace mode="detail" companyId="hualang" />);

    expect(screen.queryByTestId("number-form")).not.toBeInTheDocument();
    expect(screen.getByText("閲覧権限のため、進行期の編集フォームは表示していません。"))
      .toBeInTheDocument();
  });
});
