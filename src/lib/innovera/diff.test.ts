import { describe, expect, it } from "vitest";
import { diffInnoveraKintone, fdNumber, normalizeHistoryRows } from "./diff";
import type { InnoveraCircuit, KintoneInnoveraRecord } from "./types";

const nowIso = "2026-10-07T05:35:00.000Z";
const today = "2026-10-07";

function circuit(overrides: Partial<InnoveraCircuit> = {}): InnoveraCircuit {
  return {
    circuit_num: "004",
    name: "旧名",
    number: "05012345678",
    free_number: "",
    related_number: "",
    inserted: "2026-09-16 10:11:12",
    ...overrides,
  };
}

function record(overrides: Partial<KintoneInnoveraRecord> = {}): KintoneInnoveraRecord {
  return {
    $id: { value: "10" },
    識別番号: { value: "004" },
    回線番号: { value: "05012345678" },
    FD番号: { value: "05012345678" },
    最終回線名称: { value: "旧名" },
    最終番号ステータス: { value: "未使用" },
    発番日: { value: "2026-09-16" },
    廃止日: { value: "" },
    ドロップダウン: { value: "" },
    最終入力日時: { value: "2026-09-16T01:11:12Z" },
    最終行番号: { value: "1" },
    テーブル: {
      value: [{
        id: "row-1",
        value: {
          回線名称: { value: "旧名" },
          入力日時: { value: "2026-09-16T01:11:12Z" },
          入力者: { value: [{ code: "Garden" }] },
          行番号: { value: "1" },
          番号ステータス: { value: "未使用" },
        },
      }],
    },
    ...overrides,
  };
}

describe("diffInnoveraKintone", () => {
  it("creates a new record action with initial history", () => {
    const [action] = diffInnoveraKintone([circuit({ circuit_num: "4", free_number: "08006000000" })], [], { nowIso, today });
    expect(action.kind).toBe("added");
    expect(action.circuitNum).toBe("004");
    expect(action.issuedDate).toBe("2026-09-16");
    expect(action.writeRecord).toMatchObject({
      識別番号: { value: "004" },
      FD番号: { value: "08006000000" },
      最終番号ステータス: { value: "未使用" },
      発番日: { value: "2026-09-16" },
      最終行番号: { value: "1" },
    });
  });

  it("detects a name change and keeps the current status", () => {
    const [action] = diffInnoveraKintone(
      [circuit({ name: "新名" })],
      [record({ 最終番号ステータス: { value: "使用中" }, 最終行番号: { value: "3" } })],
      { nowIso, today },
    );
    expect(action.kind).toBe("renamed");
    expect(action.writeRecord).toMatchObject({
      最終回線名称: { value: "新名" },
      最終行番号: { value: "4" },
    });
    expect(action.writeRecord?.テーブル).toMatchObject({
      value: expect.arrayContaining([expect.objectContaining({ value: expect.objectContaining({ 番号ステータス: { value: "使用中" } }) })]),
    });
  });

  it("normalizes existing history rows before writing them back", () => {
    const [action] = diffInnoveraKintone(
      [circuit({ name: "新名" })],
      [record({
        テーブル: {
          value: [{
            id: "row-1",
            value: {
              回線名称: { type: "SINGLE_LINE_TEXT", value: "旧名" },
              入力日時: { type: "DATETIME", value: "2026-09-16T01:11:12Z" },
              入力者: { type: "USER_SELECT", value: [{ code: "Garden" }] },
              行番号: { type: "NUMBER", value: "1" },
              番号ステータス: { type: "DROP_DOWN", value: "未使用" },
            },
          }],
        },
      })],
      { nowIso, today },
    );
    const table = action.writeRecord?.テーブル as KintoneInnoveraRecord["テーブル"];
    expect(JSON.stringify(table)).not.toContain("\"type\"");
    expect(table?.value[0]).toMatchObject({ id: "row-1", value: { 回線名称: { value: "旧名" } } });
  });

  it("retires a missing Kintone record", () => {
    const [action] = diffInnoveraKintone([], [record({ 廃止日: { value: "" }, ドロップダウン: { value: "依頼中" } })], { nowIso, today });
    expect(action.kind).toBe("retired");
    expect(action.writeRecord).toMatchObject({
      最終番号ステータス: { value: "削除" },
      廃止日: { value: today },
      ドロップダウン: { value: "" },
      最終行番号: { value: "2" },
    });
  });

  it("asks for review on number mismatch", () => {
    const [action] = diffInnoveraKintone([circuit({ number: "050-9999-9999" })], [record()], { nowIso, today });
    expect(action).toMatchObject({ kind: "needs_review", reason: "number_mismatch" });
    expect(action.writeRecord).toBeUndefined();
  });

  it("asks for review when a deleted number returns", () => {
    const [action] = diffInnoveraKintone([circuit()], [record({ 最終番号ステータス: { value: "削除" } })], { nowIso, today });
    expect(action).toMatchObject({ kind: "needs_review", reason: "restored_deleted" });
  });

  it("returns no changes for identical data and for a second run", () => {
    expect(diffInnoveraKintone([circuit()], [record()], { nowIso, today })).toHaveLength(0);
    const renamed = diffInnoveraKintone([circuit({ name: "新名" })], [record()], { nowIso, today })[0];
    expect(diffInnoveraKintone([circuit({ name: "新名" })], [record({ 最終回線名称: { value: "新名" }, テーブル: renamed.writeRecord?.テーブル as KintoneInnoveraRecord["テーブル"] })], { nowIso, today })).toHaveLength(0);
  });

  it("matches zero-padded circuit numbers", () => {
    expect(diffInnoveraKintone([circuit({ circuit_num: "4" })], [record({ 識別番号: { value: "004" } })], { nowIso, today })).toHaveLength(0);
  });

  it("chooses FD number by free, related, then line number", () => {
    expect(fdNumber(circuit({ free_number: "0120", related_number: "0990", number: "050" }))).toBe("0120");
    expect(fdNumber(circuit({ free_number: "", related_number: "0990", number: "050" }))).toBe("0990");
    expect(fdNumber(circuit({ free_number: "", related_number: "", number: "050" }))).toBe("050");
  });

  it("normalizes a history row directly", () => {
    expect(normalizeHistoryRows([{ id: "row", value: { 回線名称: { type: "SINGLE_LINE_TEXT", value: "名前" } } }])).toEqual([{ id: "row", value: { 回線名称: { value: "名前" } } }]);
  });

  it("ignores leading and trailing name spaces", () => {
    expect(diffInnoveraKintone([circuit({ name: " 旧名 " })], [record({ 最終回線名称: { value: "旧名" } })], { nowIso, today })).toHaveLength(0);
  });
});
