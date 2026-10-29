import { dueNotice, noticeMessage, unfiledMessage, type Forwarding, type Notice } from "./domain";
export type NoticeStore = {
  claim(n: Notice): Promise<boolean>;
  sent(n: Notice): Promise<void>;
  release(n: Notice): Promise<void>;
};
// mention=false のときは TO を付けない（届出待ちのまとめ）。
export async function deliverNotices(rows: Forwarding[], notices: Notice[], today: string, dryRun: boolean, store: NoticeStore, send: (message: string, mention: boolean) => Promise<void>) {
  const results: { id: string; stage: string; message: string; status: string }[] = [];
  const unfiled: { row: Forwarding; notice: Notice }[] = [];
  for (const row of rows) {
    const notice = dueNotice(row, notices, today);
    if (!notice) continue;
    if (notice.stage === "unfiled") { unfiled.push({ row, notice }); continue; }
    const message = noticeMessage(row, notice, today);
    if (dryRun) { results.push({ id: row.id, stage: notice.stage, message, status: "dryRun" }); continue; }
    if (!await store.claim(notice)) continue;
    try { await send(message, true); }
    catch { await store.release(notice); results.push({ id: row.id, stage: notice.stage, message, status: "failed" }); continue; }
    // 送信後の記録失敗を送信失敗と混同して予約解除しない。
    await store.sent(notice);
    results.push({ id: row.id, stage: notice.stage, message, status: "sent" });
  }
  // 届出待ちは週に 1 通へまとめる。
  if (unfiled.length === 0) return results;
  if (dryRun) {
    const message = unfiledMessage(unfiled.map(u => u.row));
    for (const u of unfiled) results.push({ id: u.row.id, stage: "unfiled", message, status: "dryRun" });
    return results;
  }
  const claimed: typeof unfiled = [];
  for (const u of unfiled) if (await store.claim(u.notice)) claimed.push(u);
  if (claimed.length === 0) return results;
  const message = unfiledMessage(claimed.map(u => u.row));
  try { await send(message, false); }
  catch {
    for (const u of claimed) { await store.release(u.notice); results.push({ id: u.row.id, stage: "unfiled", message, status: "failed" }); }
    return results;
  }
  for (const u of claimed) { await store.sent(u.notice); results.push({ id: u.row.id, stage: "unfiled", message, status: "sent" }); }
  return results;
}
