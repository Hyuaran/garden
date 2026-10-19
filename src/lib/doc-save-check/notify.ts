import { ChatworkClient } from "@/lib/chatwork";
import { direction, electronicService, ROOTS, type DocKind } from "./classify";
import type { JudgeCounts, JudgedItem } from "./judge";
export type Notifier = { send(message: string): Promise<void> };
export class ChatworkNotifier implements Notifier {
  async send(message: string) {
    const token = process.env.CHATWORK_API_TOKEN;
    const room = process.env.DOC_SAVE_CHECK_CHATWORK_ROOM_ID || process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID;
    if (!token || !room) throw new Error("DOC_SAVE_CHECK の Chatwork 通知設定がありません");
    await new ChatworkClient(token).sendMessage(room, message);
  }
}
const clean = (text: string) => text.replace(/\[/g, "［").replace(/\]/g, "］");
export function reportMessage(today: string, items: JudgedItem[], counts: JudgeCounts): string {
  const sections: string[] = [];
  for (const kind of Object.keys(ROOTS) as DocKind[]) {
    const lines = items.filter(i => i.kind === kind && ["missing", "autosaved"].includes(i.status)).map(i => {
      const m = i.mail;
      const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "medium" }).format(new Date(m.receivedAt));
      const outgoing = direction(m) === "out";
      return `・${outgoing ? "送信" : "受信"} ${date} 差出人 ${clean(m.sender)}（宛先 ${clean((m.toRecipients ?? []).join("、"))}）\n　件名：${clean(m.subject)}\n　添付：${clean(i.fileName)}${i.driveUrl ? `\n　→ 00_自動保存（未整理）に保存しました ${i.driveUrl}` : ""}`;
    });
    if (lines.length) sections.push(`■${ROOTS[kind].label}\n${lines.join("\n\n")}`);
  }
  const downloads = items.filter(i => i.status === "needs-download").map(({ mail: m }) => {
    const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "medium" }).format(new Date(m.receivedAt));
    return `・受信 ${date} ${clean(electronicService(m)?.name ?? m.sender.split("@")[1] ?? m.sender)}（宛先の箱 ${clean(m.mailboxes.join("、"))}）\n　件名：${clean(m.subject)}`;
  });
  if (downloads.length) sections.push(`■電子契約（PDF が付いていない＝電子契約のサービスから取り出して 13_契約書 に保存してください）\n${downloads.join("\n\n")}`);
  return `[info][title]契約書・条件表の保存チェック ${today}（未保存 ${counts.missing} 件・自動保存 ${counts.autosaved} 件・取り出し必要 ${counts.needsDownload} 件）[/title]${sections.join("\n\n")}\n\n保存の確認：候補のメール ${counts.candidateMails} 通・添付 ${counts.attachments} 件／保存済み ${counts.saved} 件／自動保存履歴あり ${counts.previouslySaved} 件${counts.superseded ? `\n新しい版が保存済みの古い版 ${counts.superseded} 件` : ""}[/info]`;
}
export const allClearMessage = (today: string) => `[info][title]契約書・条件表の保存チェック ${today}[/title]異常なし（未保存はありません）。[/info]`;
export const failureMessage = (error: string) => `[info][title]契約書・条件表の保存チェックが失敗しています[/title]${clean(error)}\n直るまで同じ知らせは送りません。[/info]`;
export const recoveryMessage = () => "[info][title]契約書・条件表の保存チェックが回復しました[/title]通常どおり動いています。[/info]";
