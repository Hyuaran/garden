import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { extractReport } from "@/lib/bud/ichi-report/model";
import IchiReport, { type ReportResult } from "./IchiReport";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), router: vi.fn() }));
vi.mock("./IchiChart", () => ({ default: ({ title }: { title: string }) => <div>{title}</div> }));
vi.mock("./ichi-actions", () => ({ refreshIchiReport: mocks.refresh }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.router }) }));
afterEach(cleanup);
const data = extractReport(readFileSync("src/lib/bud/ichi-report/__fixtures__/report.html", "utf8"));
const result: ReportResult = { snapshot: { deployment_id: "example", data, updated: String(data.updated), checked_at: "2026-11-12T00:00:00Z", fetched_at: "2026-11-12T00:00:00Z", failed: false }, warning: false };
it("サーバーで描いた時点で4つのまとまり・数字・集計中・日時が揃う", () => {
  const html = renderToStaticMarkup(<IchiReport initial={result} />);
  expect(html).toContain("ユーザー・獲得");
  expect(html).toContain("請求・入金");
  expect(html).toContain("原価・利益");
  expect(html).toContain("要確認リスト");
  expect(html).toContain("集計中");
  expect(html).toContain("後道さんの更新：2026/11/11");
  expect(html).not.toContain("visibility:hidden");
  expect(html).not.toContain("iframe");
  expect(html).toContain("https://example.cybozu.com/k/999/show#record=900");
});
it("前回の内容を残して読み取り失敗を知らせ、手動で取り直せる", async () => {
  render(<IchiReport initial={{ ...result, warning: true }} />);
  expect(screen.getByRole("alert").textContent).toContain("最新を読めませんでした（前回 2026年11月11日 12:33 の内容）");
  mocks.refresh.mockResolvedValue(result);
  fireEvent.click(screen.getByRole("button", { name: "Ichi光事業の最新を読み直す" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});
it("不足する項目や未知の形式でも落ちず、欠損は - を出す", () => {
  render(<IchiReport initial={{ ...result, snapshot: { ...result.snapshot!, data: { months: [null, {}, { m: "unknown", users: "bad" }], billing: [] } } }} />);
  expect(screen.getAllByText("-").length).toBeGreaterThan(0);
});
