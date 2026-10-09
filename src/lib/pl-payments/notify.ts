import { ChatworkClient } from "@/lib/chatwork";

import { effectivePaymentDate } from "./business-day";
import type { PaymentTaskRow, PlPaymentRecord, TransferCreateResult } from "./types";

export type Notifier = {
  send(message: string): Promise<void>;
};

export class ChatworkNotifier implements Notifier {
  private readonly client: ChatworkClient;
  private readonly roomId: string;

  constructor(options: { dryRun?: boolean } = {}) {
    const token = process.env.CHATWORK_API_TOKEN;
    const roomId = process.env.PL_PAYMENTS_CHATWORK_ROOM_ID || process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID;
    if (!token) throw new Error("CHATWORK_API_TOKEN が設定されていません");
    if (!roomId) throw new Error("PL_PAYMENTS_CHATWORK_ROOM_ID が設定されていません");
    this.client = new ChatworkClient(token, { dryRun: options.dryRun });
    this.roomId = roomId;
  }

  async send(message: string): Promise<void> {
    await this.client.sendMessage(this.roomId, message);
  }
}

export function yen(value: number | null | undefined): string {
  return `${Number(value ?? 0).toLocaleString("ja-JP")} 円`;
}

export function newPaymentsMessage(records: PlPaymentRecord[]): string {
  const lines = records.map(
    (record) =>
      `取引先：${record.vendor}（${record.mfCompany}）\n支払金額：${yen(record.amount)}　支払期日：${record.dueDate || "未入力"}（振込は ${record.dueDate ? effectivePaymentDate(record.dueDate) : "未定"}）\n担当：${record.owner}　レコード：${record.recordUrl}`,
  );
  return `[info][title]損益：支払待ちが登録されました[/title]${lines.join("\n\n")}[/info]`;
}

export function driveProblemMessage(record: PlPaymentRecord, note: string): string {
  return `[info][title]請求書リンクを確認してください[/title]取引先：${record.vendor}（${record.mfCompany}）\n対象月：${record.periodDate || record.dueDate}\n理由：${note}\nレコード：${record.recordUrl}[/info]`;
}

export function transferProblemMessage(record: PlPaymentRecord, note: string): string {
  return `[info][title]振込の作成を確認してください[/title]取引先：${record.vendor}（${record.mfCompany}）\n支払金額：${yen(record.amount)}\n理由：${note}\nレコード：${record.recordUrl}[/info]`;
}

export function transferCreatedMessage(record: PlPaymentRecord, transfer: TransferCreateResult, effectiveDueDate: string): string {
  return `[info][title]振込依頼・振込実行を作成しました[/title]取引先：${record.vendor}　${yen(record.amount)}　振込期日：${effectiveDueDate}\n振込依頼 ${transfer.requestId ?? "-"} ／ 振込実行 ${transfer.executeId ?? "-"} ／ 振込ID ${transfer.transferId}\n${transfer.executeUrl ?? record.recordUrl}[/info]`;
}

export function failureMessage(name: string, error: string): string {
  return `[info][title]損益の見張り（${name}）が失敗しています[/title]${error}\n直るまで同じ知らせは送りません。[/info]`;
}

export function recoveryMessage(name: string): string {
  return `[info][title]損益の見張り（${name}）が回復しました[/title]通常どおり動いています。[/info]`;
}

export function reminderMessage(date: string, rows: PaymentTaskRow[]): string {
  const lines = rows.map((row) => `・${row.vendor ?? ""} ${yen(row.amount)}（振込実行 ${row.transfer_execute_id ?? "-"}）`);
  return `[info][title]明日 ${date} が振込期日です[/title]${lines.join("\n")}[/info]`;
}

export function unreservedMessage(date: string, rows: Array<PaymentTaskRow & { executeStatus?: string }>): string {
  const lines = rows.map(
    (row) => `・${row.vendor ?? ""} ${yen(row.amount)}（振込実行 ${row.transfer_execute_id ?? "-"}：ステータス ${row.executeStatus || "-"}）`,
  );
  return `[info][title]振込の予約が確認できません（期日 ${date}）[/title]${lines.join("\n")}\n振込実行で予約を済ませてください。[/info]`;
}
