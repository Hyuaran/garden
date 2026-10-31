import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ role: "super_admin" }));
vi.mock("../_state/RootStateContext", () => ({ useRootState: () => ({ gardenRole: m.role }) }));
import Page from "./page";
it.each(["super_admin", "staff"])("最低賃金は権限に応じて行から修正する（%s）", async role => {
  m.role = role;
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ rows: [{ id: "w1", prefecture: "大阪府", hourly_amount: 1200, effective_from: "2026-10-01", updated_at: "2026-10-31T00:00:00Z", source_url: "https://example.com/source" }] })));
  render(<Page />);
  const row = (await screen.findByText("大阪府")).closest("tr")!;
  expect(screen.queryByRole("columnheader", { name: "操作" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "出典を見る" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.keyDown(row, { key: "Enter" });
  if (role === "super_admin") expect(screen.getByRole("dialog", { name: "最低賃金を修正" })).toBeInTheDocument();
  else expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
