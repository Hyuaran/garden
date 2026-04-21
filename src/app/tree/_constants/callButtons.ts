/**
 * Garden-Tree 架電結果ボタン定義
 *
 * 架電画面で使う結果ボタンの色・ラベル・グループを一元管理。
 *
 * - SPROUT_BUTTONS: Sprout（アポインター）用 — 「トス」で始まる
 * - RESULT_BUTTONS: Branch（クローザー）用  — 「受注」で始まる
 *
 * group: "top" / "bottom" でボタン配置の上段・下段を分ける。
 */

import { C } from "./colors";

export type CallButton = {
  label: string;
  color: string;
  group: "top" | "bottom";
};

/** Sprout 架電画面用（Breeze モード） */
export const SPROUT_BUTTONS: CallButton[] = [
  { label: "トス", color: C.midGreen, group: "top" },
  { label: "担不", color: "#999", group: "top" },
  { label: "見込 A", color: "#3478c6", group: "top" },
  { label: "見込 B", color: "#5a9ac6", group: "top" },
  { label: "見込 C", color: "#7ab0d4", group: "top" },
  { label: "不通", color: "#999", group: "bottom" },
  { label: "NG お断り", color: C.softRed, group: "bottom" },
  { label: "NG クレーム", color: C.red, group: "bottom" },
  { label: "NG 契約済", color: "#a06040", group: "bottom" },
  { label: "NG その他", color: "#888", group: "bottom" },
];

/** Branch 架電画面用（Dew モード） */
export const RESULT_BUTTONS: CallButton[] = [
  { label: "受注", color: C.midGreen, group: "top" },
  { label: "担不", color: "#999", group: "top" },
  { label: "コイン", color: C.gold, group: "top" },
  { label: "見込 A", color: "#3478c6", group: "top" },
  { label: "見込 B", color: "#5a9ac6", group: "top" },
  { label: "見込 C", color: "#7ab0d4", group: "top" },
  { label: "不通", color: "#999", group: "bottom" },
  { label: "NG お断り", color: C.softRed, group: "bottom" },
  { label: "NG クレーム", color: C.red, group: "bottom" },
  { label: "NG 契約済", color: "#a06040", group: "bottom" },
  { label: "NG その他", color: "#888", group: "bottom" },
];
