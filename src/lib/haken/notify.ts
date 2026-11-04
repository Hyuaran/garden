import type { HakenNotice } from "./ledger";
export type NoticeStore = {
  claim: (key: string) => Promise<boolean>;
  sent: (key: string) => Promise<void>;
};
export async function deliverHakenNotices(
  notices: HakenNotice[],
  today: string,
  dryRun: boolean,
  store: NoticeStore,
  send: (message: string) => Promise<void>,
) {
  const due = notices.filter((n) =>
    n.kind === "個別契約書" ? n.due <= today : !n.due || n.due === today,
  );
  const results: { key: string; status: string }[] = [];
  for (const notice of due) {
    if (dryRun) {
      results.push({ key: notice.key, status: "確認のみ" });
      continue;
    }
    if (!(await store.claim(notice.key))) continue;
    // 送信後の応答消失でも二重送信しない。失敗した予約は残し、人が確認する。
    try {
      await send(`派遣管理：${notice.kind}\n${notice.content}\nhttps://garden-os.net/system/haken?tab=deadlines`);
      await store.sent(notice.key);
      results.push({ key: notice.key, status: "送信済み" });
    } catch {
      const key = `failure:${notice.key}`;
      if (await store.claim(key)) {
        await send(
          "派遣管理の知らせを送れませんでした。期限と未回収を確認してください。",
        )
          .then(() => store.sent(key))
          .catch(() => {});
      }
      results.push({ key: notice.key, status: "送信できませんでした" });
    }
  }
  return results;
}
