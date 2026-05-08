import { describe, it, expect } from "vitest";
import {
  getStatusColor,
  getStatusOrder,
  isTerminalStatus,
} from "../status-display";

describe("getStatusColor", () => {
  it("下書き → gray", () => {
    expect(getStatusColor("下書き")).toBe("gray");
  });
  it("確認済み → blue", () => {
    expect(getStatusColor("確認済み")).toBe("blue");
  });
  it("承認待ち → yellow", () => {
    expect(getStatusColor("承認待ち")).toBe("yellow");
  });
  it("承認済み → emerald", () => {
    expect(getStatusColor("承認済み")).toBe("emerald");
  });
  it("CSV出力済み → indigo", () => {
    expect(getStatusColor("CSV出力済み")).toBe("indigo");
  });
  it("振込完了 → green", () => {
    expect(getStatusColor("振込完了")).toBe("green");
  });
  it("差戻し → red", () => {
    expect(getStatusColor("差戻し")).toBe("red");
  });
});

describe("getStatusOrder", () => {
  it("進行順に番号を返す", () => {
    expect(getStatusOrder("下書き")).toBe(1);
    expect(getStatusOrder("確認済み")).toBe(2);
    expect(getStatusOrder("承認待ち")).toBe(3);
    expect(getStatusOrder("承認済み")).toBe(4);
    expect(getStatusOrder("CSV出力済み")).toBe(5);
    expect(getStatusOrder("振込完了")).toBe(6);
    expect(getStatusOrder("差戻し")).toBe(0);
  });
});

describe("isTerminalStatus", () => {
  it("振込完了は terminal", () => {
    expect(isTerminalStatus("振込完了")).toBe(true);
  });
  it("他のステータスは non-terminal", () => {
    expect(isTerminalStatus("下書き")).toBe(false);
    expect(isTerminalStatus("差戻し")).toBe(false);
  });
});
