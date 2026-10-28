import { dueNotice, noticeMessage, type Forwarding, type Notice } from "./domain";
export type NoticeStore = {
  claim(n: Notice): Promise<boolean>;
  sent(n: Notice): Promise<void>;
  release(n: Notice): Promise<void>;
};
export async function deliverNotices(rows: Forwarding[], notices: Notice[], today: string, dryRun: boolean, store: NoticeStore, send: (message: string) => Promise<void>) {
  const results: { id: string; stage: string; message: string; status: string }[] = [];
  for (const row of rows) {
    const notice = dueNotice(row, notices, today);
    if (!notice) continue;
    const message = noticeMessage(row, notice, today);
    if (dryRun) { results.push({ id: row.id, stage: notice.stage, message, status: "dryRun" }); continue; }
    if (!await store.claim(notice)) continue;
    try { await send(message); }
    catch { await store.release(notice); results.push({ id: row.id, stage: notice.stage, message, status: "failed" }); continue; }
    // 送信後の記録失敗を送信失敗と混同して予約解除しない。
    await store.sent(notice);
    results.push({ id: row.id, stage: notice.stage, message, status: "sent" });
  }
  return results;
}
