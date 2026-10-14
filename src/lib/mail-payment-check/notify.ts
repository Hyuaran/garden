import { ChatworkClient } from "@/lib/chatwork";

import { jstDateTime, type JudgeCounts, type JudgedItem } from "./judge";

export type Notifier = { send(message: string): Promise<void> };

export class ChatworkNotifier implements Notifier {
  private readonly client: ChatworkClient;
  private readonly roomId: string;

  constructor() {
    const token = process.env.CHATWORK_API_TOKEN;
    const roomId = process.env.MAIL_PAYMENT_CHECK_CHATWORK_ROOM_ID || process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID;
    if (!token) throw new Error("CHATWORK_API_TOKEN が設定されていません");
    if (!roomId) throw new Error("MAIL_PAYMENT_CHECK_CHATWORK_ROOM_ID が設定されていません");
    this.client = new ChatworkClient(token);
    this.roomId = roomId;
  }

  async send(message: string): Promise<void> {
    await this.client.sendMessage(this.roomId, message);
  }
}

function itemLines(item: JudgedItem): string {
  const head = item.vendor ? `・${item.vendor}` : `・差出人 ${item.sender}`;
  const lines = [`${head}（宛先 ${item.mailbox}）受信 ${jstDateTime(item.receivedAt)}`];
  if (item.dueDate) lines.push(`　期日の目安：${item.dueDate}`);
  lines.push(`　${item.reason}`);
  if (item.reserved) lines.push(`　予約：振込依頼 ${item.reserved.id}（支払期日 ${item.reserved.dueDate}）`);
  if (item.saved) lines.push(`　保存：${item.saved.name}`);
  lines.push(`　件名：${item.subject}`);
  return lines.join("\n");
}

export function reportMessage(input: {
  today: string;
  items: JudgedItem[];
  counts: JudgeCounts;
  failedMailboxes: Array<{ mailbox: string; error: string }>;
}): string {
  const action = input.items.filter((item) => item.kind === "action");
  const human = input.items.filter((item) => item.kind === "human");
  const sections: string[] = [];
  if (action.length) sections.push(`■要対応（期日が近いのに、予約か保存が見つかりません）\n${action.map(itemLines).join("\n")}`);
  if (human.length) sections.push(`■人の確認が必要（前回のチェック以降に届いたものだけ・1 回だけ知らせます）\n${human.map(itemLines).join("\n")}`);
  if (input.failedMailboxes.length) {
    sections.push(`■読めなかった受信箱（${input.failedMailboxes.length} 箱）\n${input.failedMailboxes.map((row) => `・${row.mailbox}`).join("\n")}`);
  }
  const summary = `請求関連メール ${input.counts.invoiceRelated} 件／確認済み ${input.counts.ok} 件／期日前 ${input.counts.upcoming} 件`;
  return `[info][title]支払漏れチェック ${input.today}（要対応 ${action.length} 件・人の確認 ${human.length} 件）[/title]${sections.join("\n\n")}\n\n${summary}[/info]`;
}

export function allClearMessage(today: string, counts: JudgeCounts): string {
  return `[info][title]支払漏れチェック ${today}[/title]要対応はありません。\n請求関連メール ${counts.invoiceRelated} 件／確認済み ${counts.ok} 件／期日前 ${counts.upcoming} 件\n（異常なしの知らせは月曜だけ送ります）[/info]`;
}

export function failureMessage(error: string): string {
  return `[info][title]支払漏れチェックが失敗しています[/title]${error}\n直るまで同じ知らせは送りません。[/info]`;
}

export function recoveryMessage(): string {
  return `[info][title]支払漏れチェックが回復しました[/title]通常どおり動いています。[/info]`;
}
