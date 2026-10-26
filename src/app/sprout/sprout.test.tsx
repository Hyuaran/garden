import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { applicant } from "@/lib/sprout/model";

const m = vi.hoisted(() => ({ load: vi.fn(), detail: vi.fn() }));
vi.mock("./actions", () => ({ loadSprout: m.load, loadApplicantDetail: m.detail, refreshSprout: vi.fn(), sendToHire: vi.fn() }));
vi.mock("./sprout-shell", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
import Sprout from "./sprout";

beforeEach(() => {
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
