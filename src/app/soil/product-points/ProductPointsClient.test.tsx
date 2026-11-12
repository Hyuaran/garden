// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PointRow } from "@/lib/product-points";
import seeds from "@/lib/product-points/initial-values.json";
import ProductPointsClient from "./ProductPointsClient";

const save = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ savePoint: save }));
vi.mock(
  "@/app/system/_components/ViewPermissionButton/SystemViewContext",
  () => ({
    SystemViewButton: () => null,
    SystemViewHeading: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  }),
);
vi.mock("@/app/system/_components/DataTable/DataTable", () => ({
  default: ({
    rows,
    onRowClick,
  }: {
    rows: PointRow[];
    onRowClick: (row: PointRow) => void;
  }) => (
    <div data-testid="rows">
      {rows.map((row) => (
        <button key={row.id} onClick={() => onRowClick(row)}>
          {row.product} {row.total_points} {row.start_date} {row.end_date}
        </button>
      ))}
    </div>
  ),
}));
const row = {
  ...seeds[0],
  id: "source",
  channel: "hakuchi",
  start_date: "2026-11-01",
  end_date: null,
  closer_points: 1,
  updated_at: "2026-11-12T00:00:00Z",
  updated_by: null,
  note: null,
} as PointRow;
afterEach(() => {
  cleanup();
  save.mockReset();
});

it("閲覧者に追加・保存・期間切り替えを出さない", () => {
  render(
    <ProductPointsClient
      initialRows={[row]}
      canWrite={false}
      today="2026-11-12"
    />,
  );
  expect(screen.queryByText("追加する")).toBeNull();
  fireEvent.click(screen.getByText(/BIGLOBE光/));
  expect(screen.queryByText("保存する")).toBeNull();
  expect(screen.queryByText("この日から新しいポイントにする")).toBeNull();
  expect(screen.getByLabelText("商材")).toBeDisabled();
});

it("期間切り替えは先に2行を表示し、失敗したら元へ戻す", async () => {
  let finish: (value: { error: string }) => void = () => {};
  save.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(
    <ProductPointsClient initialRows={[row]} canWrite today="2026-11-12" />,
  );
  fireEvent.click(screen.getByText(/BIGLOBE光/));
  fireEvent.click(screen.getByText("この日から新しいポイントにする"));
  fireEvent.change(screen.getByLabelText("合計付与ポイント"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByText("保存する"));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ total_points: 2 }),
    "source",
    row.updated_at,
    true,
  );
  fireEvent.click(screen.getByLabelText("終わった期間も出す"));
  expect(screen.getByTestId("rows").children).toHaveLength(2);
  finish({ error: "保存に失敗しました。" });
  await waitFor(() =>
    expect(screen.getByTestId("rows").children).toHaveLength(1),
  );
  expect(screen.getAllByText("保存に失敗しました。").length).toBeGreaterThan(0);
});

it("重複は上で知らせ、保存を呼ばない", () => {
  render(
    <ProductPointsClient initialRows={[row]} canWrite today="2026-11-12" />,
  );
  fireEvent.click(screen.getByText("追加する"));
  fireEvent.change(screen.getByLabelText("商材"), {
    target: { value: row.product },
  });
  fireEvent.click(screen.getByText("保存する"));
  expect(save).not.toHaveBeenCalled();
  expect(
    screen.getAllByText(/同じ商材・獲得方法で期間が重なっています/).length,
  ).toBeGreaterThan(0);
});
