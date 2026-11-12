import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import StickyTable from "./useStickyTable";
import DataTable from "../DataTable/DataTable";
afterEach(cleanup);
it("StickyTableに共通の表クラスを付け、画面のクラスも保つ", () => {
  const { container } = render(<div><StickyTable className="local"><tbody><tr><td>値</td></tr></tbody></StickyTable></div>);
  expect(container.querySelector("table")?.className).toBe("garden-table local");
});
it("DataTableも同じ罫線と列の色を使う", () => {
  const { container } = render(<DataTable rows={[{ id: "1" }]} columns={[{ id: "id", label: "番号", value: row => row.id, type: "text" }]} rowKey={row => row.id} searchText={row => row.id} defaultSort={{ id: "id", direction: "asc" }}/>);
  expect(container.querySelector("table")?.classList.contains("garden-table")).toBe(true);
});
