import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/bud/broadband/access", () => ({ broadbandAccess: mocks.access }));
vi.mock("@/lib/bud/ichi-report/read.server", () => ({ readIchiReport: mocks.read }));
vi.mock("@/lib/ui/withInitialUrlView.server", () => ({ withInitialUrlView: (page: unknown) => page }));
import Page from "./page";
import { refreshIchiReport } from "./ichi-actions";
it("事業の収支の閲覧権限が無い人は初期データも手動更新も読めない", async () => {
  mocks.access.mockResolvedValue({ ok: false, status: 403 });
  expect(renderToStaticMarkup(await Page({}))).toContain("権限がありません");
  expect(mocks.read).not.toHaveBeenCalled();
  await expect(refreshIchiReport()).rejects.toThrow("権限がありません");
  expect(mocks.read).not.toHaveBeenCalled();
});
it("許可された人だけ手動更新できる", async () => {
  mocks.access.mockResolvedValue({ ok: true });
  mocks.read.mockResolvedValue({ snapshot: null, warning: true });
  await refreshIchiReport();
  expect(mocks.read).toHaveBeenCalledWith(true);
});
