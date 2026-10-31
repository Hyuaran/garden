import { SystemViewProvider } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { applicant } from "@/lib/sprout/model";

const m = vi.hoisted(() => ({ load: vi.fn(), detail: vi.fn() }));
vi.mock("./actions", () => ({ loadSprout: m.load, loadApplicantDetail: m.detail, refreshSprout: vi.fn(), sendToHire: vi.fn() }));
vi.mock("./sprout-shell", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
import Sprout from "./sprout";

vi.mock("next/navigation", () => ({ usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ refresh: vi.fn() }) }));

beforeEach(() => {
  window.history.replaceState(null, "", "/sprout");
  vi.resetAllMocks();
  const full = applicant({ $id: { value: "42" }, 従業員名_姓名: { value: "山田 花子" }, 連絡先_ハイフンなし: { value: "09012345678" } });
  const { raw: _raw, ...summary } = full;
  summary.applied_date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
  m.load.mockResolvedValue({ applicants: [summary], hearings: [], sent: [], updated: null });
});
afterEach(cleanup);

it("shows basic information immediately, lazily loads raw and reuses it after reopening", async () => {
  let resolve!: (value: { raw: Record<string, unknown>; hearings: [] }) => void;
  m.detail.mockReturnValue(new Promise(r => { resolve = r; }));
  render(<Sprout />);
  fireEvent.click(await screen.findByRole("button", { name: "山田 花子" }));
  const panel = screen.getByRole("region", { name: "応募者の詳細" });
  expect(within(panel).getByText("09012345678")).toBeInTheDocument();
  expect(within(panel).getAllByText("詳細を読み込んでいます…").length).toBeGreaterThan(0);
  expect(m.detail).toHaveBeenCalledWith("42", "applicants");
  resolve({ raw: { 希望給与: "詳細の給与" }, hearings: [] });
  expect(await within(panel).findByText("詳細の給与")).toBeInTheDocument();
  fireEvent.click(within(panel).getByRole("button", { name: "閉じる" }));
  fireEvent.click(screen.getByRole("button", { name: "山田 花子" }));
  expect(await screen.findByText("詳細の給与")).toBeInTheDocument();
  expect(m.detail).toHaveBeenCalledTimes(1);
});

it("keeps only the name and phone search", async () => {
 render(<Sprout />);
 await screen.findByRole("button", {name:"山田 花子"});
 expect(screen.getAllByRole("searchbox")).toHaveLength(1);
 expect(screen.getByText("名前・電話で探す")).toBeInTheDocument();
});

it("uses header filters for status and month while initially showing this month", async () => {
 const full = applicant({ $id: { value: "43" }, 従業員名_姓名: { value: "佐藤 太郎" } });
 const {raw: _raw, ...older} = full;
 older.applied_date = "2020-01-15";
 older.status = "過去の応募";
 const current = (await m.load()).applicants[0];
 current.status = "確認中";
 m.load.mockResolvedValue({applicants:[current, older],hearings:[],sent:[],updated:null});
 render(<Sprout />);
 await screen.findByRole("button",{name:"山田 花子"});
 expect(screen.queryByRole("button",{name:"佐藤 太郎"})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'期間'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'状況'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"応募日の並べ替え・絞り込み"}));
 fireEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"解除"}));
 expect(screen.getByRole("button",{name:"佐藤 太郎"})).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"状況の並べ替え・絞り込み"}));
 const menu = within(screen.getByRole("dialog"));
 fireEvent.click(menu.getByLabelText("確認中 (1)"));
 fireEvent.click(menu.getByRole("button",{name:"OK"}));
 expect(screen.queryByRole("button",{name:"山田 花子"})).not.toBeInTheDocument();
 expect(screen.getByRole("button",{name:"佐藤 太郎"})).toBeInTheDocument();
});

it("hides a single permitted tab and keeps the gear on the action row", async () => {
 render(<SystemViewProvider value={{ pageKey: "sprout", admin: true, canAdd: false, tabs: ["applicants", "interviews", "training"].map(key => ({key, label: key, allowed: key === "applicants", canAdd: false})) }}><Sprout /></SystemViewProvider>);
 await screen.findByRole("button", {name:"山田 花子"});
 expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
 expect(screen.getByRole("button", {name:"見られる人の設定"}).closest("[data-system-tabs]")).toBeTruthy();
});
