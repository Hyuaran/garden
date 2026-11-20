import { describe, expect, it } from "vitest";
import { orderStatus, type OrderStatus, type StatusInput } from "./status";

describe("受注ステータス", () => {
  it.each<[StatusInput, boolean, OrderStatus]>([
    [{}, false, "受注"],
    [{ ordered_on: "2026-11-20" }, false, "諸元待ち"],
    [{ specs_on: "2026-11-20" }, false, "エントリー待ち"],
    [{}, true, "エントリー待ち"],
    [{ entered_on: "2026-11-20" }, true, "送付待ち"],
    [{ app_sent_on: "2026-11-20" }, false, "請求待ち"],
    [{ invoice_sent_on: "2026-11-20" }, false, "入金待ち"],
    [{ payment_received_on: "2026-11-20" }, false, "支払待ち"],
    [{ payment_received_on: "2026-11-20", is_direct: true }, false, "完了"],
    [{ payment_sent_on: "2026-11-20" }, false, "完了"],
    [{ completed_on: "2026-11-20" }, false, "完了"],
    [{ completed_on: "2026-11-20", status: "保留" }, false, "保留"],
    [{ entered_on: "2026-11-20", status: "差し戻し" }, true, "差し戻し"],
    [{ cancelled_on: "2026-11-20", status: "保留" }, true, "キャンセル"],
  ])("判定 %j", (input, photo, expected) => expect(orderStatus(input, photo)).toBe(expected));
});
