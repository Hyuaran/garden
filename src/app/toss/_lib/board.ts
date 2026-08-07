import type { KintoneRecord } from "./kintone.server";

export type TossStatus = "受注" | "キャンセル" | "対応中" | "連携受付";

export type TossBoardRow = {
  id: string;
  introducedAt: string;
  partnerName: string;
  products: string[];
  rank: string;
  currentContractName: string;
  applicantName: string;
  area: string;
  status: TossStatus;
  latestActivity: string;
  latestCall: string;
  orderedProducts: string[];
  cancellationReason: string;
  partnerCode: string;
};

const scalar = (record: KintoneRecord, code: string) => {
  const value = record[code]?.value;
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};
const list = (record: KintoneRecord, code: string) => {
  const value = record[code]?.value;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
};

type CallItem = { date: string; text: string };

function findCallItems(value: unknown): CallItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const source = entry && typeof entry === "object" && "value" in entry
      ? (entry as { value: unknown }).value : entry;
    if (!source || typeof source !== "object") return null;
    const fields = source as Record<string, unknown>;
    const values = Object.entries(fields).map(([code, field]) => {
      const raw = field && typeof field === "object" && "value" in field ? (field as { value: unknown }).value : field;
      return { code, value: typeof raw === "string" ? raw : "" };
    });
    const date = values.find(({ code, value }) => /日時|日付|更新/.test(code) && /^\d{4}-\d{2}-\d{2}/.test(value))?.value || "";
    const text = values.find(({ code, value }) => /結果|内容|ステータス|履歴/.test(code) && value)?.value
      || values.find(({ value }) => value && !/^\d{4}-\d{2}-\d{2}/.test(value))?.value || "";
    return date || text ? { date, text } : null;
  }).filter((item): item is CallItem => item !== null).sort((a, b) => b.date.localeCompare(a.date));
}

export function toBoardRow(record: KintoneRecord): TossBoardRow {
  const orderedAt = scalar(record, "日付_0");
  const cancelledAt = scalar(record, "日付_4");
  const calls = findCallItems(record.コール履歴?.value);
  const latestCall = calls[0];
  // 確定イベントを優先し、同一レコードに両方ある異常時は最終イベントの日付で判定する。
  let status: TossStatus;
  if (orderedAt || cancelledAt) status = cancelledAt > orderedAt ? "キャンセル" : "受注";
  else status = latestCall ? "対応中" : "連携受付";
  const terminalDate = status === "キャンセル" ? cancelledAt : status === "受注" ? orderedAt : "";
  const latestActivity = [latestCall?.date || "", terminalDate, scalar(record, "更新日時")]
    .filter(Boolean).sort().at(-1) || "";
  return {
    id: scalar(record, "$id") || scalar(record, "レコード番号"),
    introducedAt: scalar(record, "日付"), partnerName: scalar(record, "文字列__1行__37"),
    products: list(record, "チェックボックス"), rank: scalar(record, "ドロップダウン_3"),
    currentContractName: scalar(record, "文字列__1行__28"), applicantName: scalar(record, "文字列__1行__7"),
    area: scalar(record, "文字列__1行__16") || scalar(record, "文字列__1行__25"), status,
    latestActivity,
    latestCall: latestCall?.text || "", orderedProducts: list(record, "チェックボックス_0"),
    cancellationReason: scalar(record, "ドロップダウン_7"), partnerCode: scalar(record, "ルックアップ"),
  };
}
