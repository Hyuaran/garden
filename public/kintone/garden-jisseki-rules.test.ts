import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { applyJissekiRules } = createRequire(import.meta.url)("./garden-jisseki-rules.js") as {
  applyJissekiRules: (values: Record<string, string>) => { 実績日: string; 実績可否: string };
};

describe("顧客一覧の実績ルール", () => {
  const order = "2026-10-31";
  const retry = "2026-11-01";
  const launch = "2026-11-02";

  it.each([
    ["空欄を初期化", { 受注日: order }, order, "可"],
    ["既存値を保持", { 実績日: retry, 実績可否: "否" }, retry, "否"],
    ["リトライだけ", { 受注日: order, リトライ日: retry }, order, "否"],
    ["立ち上げなしは受注日にそろえる", { 受注日: order, 実績日: retry, 実績可否: "可" }, order, "可"],
    ["立ち上げ後にリトライ", { 実績日: order, 立ち上げ日: order, リトライ日: retry }, order, "否"],
    ["立ち上げだけ", { 実績日: order, 立ち上げ日: launch }, launch, "可"],
    ["リトライ後に立ち上げ", { 実績日: order, 実績可否: "否", リトライ日: retry, 立ち上げ日: launch }, launch, "可"],
    ["リトライと同日に立ち上げ", { 受注日: order, リトライ日: retry, 立ち上げ日: retry }, retry, "可"],
    ["後確前にキャンセル", { 受注日: order, キャンセル日: retry }, order, "否"],
    ["立ち上げ後にキャンセル", { 受注日: order, 立ち上げ日: launch, キャンセル日: launch }, launch, "否"],
    ["後確後にキャンセル", { 立ち上げ日: launch, 後確OK日: launch, キャンセル日: launch }, launch, "可"],
    ["管理会社まちを優先", { 受注日: order, 立ち上げ日: launch, 商材詳細ステータス: "管理会社まち" }, "", "否"],
  ] as const)("%s", (_name, values, date, eligibility) => {
    expect(applyJissekiRules(values)).toEqual({ 実績日: date, 実績可否: eligibility });
  });
});
