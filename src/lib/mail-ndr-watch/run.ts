import type { Alert } from "./parse";
import { formatAlert, japanTime } from "./parse";
export type State = { started_at: string; last_run_at: string | null; outage: boolean; outage_notified: boolean };
export type Dependencies = {
  readState(): Promise<State | null>;
  initialize(now: string): Promise<State>;
  lock(): Promise<boolean>;
  unlock(): Promise<void>;
  saveState(state: State): Promise<void>;
  known(id: string): Promise<boolean>;
  saveAlert(alert: Alert, notifiedAt: string): Promise<void>;
  collect(since: string, startedAt: string, signal?: AbortSignal): Promise<Alert[]>;
  send(body: string): Promise<void>;
};
export function windowStart(state: State) {
  return new Date(Math.max(Date.parse(state.started_at), Date.parse(state.last_run_at ?? state.started_at) - 15 * 60_000)).toISOString();
}
// 知らせの文：何が止まったか・理由・影響・やることが分かる形に（東海林さん 2026-11-16「何が失敗なのかわかりづらい」）
export function outageReason(error: unknown) {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/deadline exceeded|abort|timeout|timed out/i.test(text)) return "Microsoft（メールの置き場）から時間内に返事がありませんでした。Microsoft 側の障害や混雑のことが多いです。";
  const code = text.match(/Graph read failed \((\d+)\)|を読めません（([^）]+)）|サインインに失敗しました（([^）]+)）/);
  if (code) return `Microsoft（メールの置き場）がエラーを返しました（${code[1] ?? code[2] ?? code[3]}）。`;
  if (/storage failed|initialization failed/i.test(text)) return "Garden のデータベースに記録できませんでした。";
  if (/chatwork/i.test(text)) return "Chatwork に知らせを送れませんでした。";
  return "想定していないエラーが起きました。";
}
export function outageMessage(reason: string, lastRunAt: string | null) {
  return `[info][title]メール送信失敗の見張りが止まっています[/title]止まったもの：会社のメールボックスに届く「配信不能」の通知（相手に届かなかったメールの知らせ）を 15 分ごとに読む見張り\n理由：${reason}\n最後に読めた時刻：${japanTime(lastRunAt)}\n影響：止まっている間は、相手に届かなかったメールがあっても、ここに知らせが来ません。メールの送信そのものは止まっていません。\nやること：対応は不要です。直ると止まっていた間の分を読み直し（最大 24 時間前まで）、「復旧しました」を送ります。半日たっても「復旧しました」が来なければ Garden開発責任者に連絡してください。[/info]`;
}
export function recoveryMessage(lastRunAt: string | null, now: string, found: number, capped: boolean) {
  const result = found ? `止まっていた間に届いていた ${found} 件を、この上に知らせました。` : "止まっていた間に、相手に届かなかったメールはありませんでした。";
  const cap = capped ? "\n※ 24 時間より前の分は読み直していません。気になるメールがあれば送信済みフォルダを確かめてください。" : "";
  return `[info][title]メール送信失敗の見張りが復旧しました[/title]止まっていた間：${japanTime(lastRunAt)} 〜 ${japanTime(now)}\n読み直しの結果：${result}${cap}[/info]`;
}
export async function runWatch(deps: Dependencies, dryRun = false, now = new Date()) {
  const timestamp = now.toISOString();
  // Leave five seconds for outage recording and releasing the lock.
  const started = Date.now();
  const controller = new AbortController();
  const workTimer = setTimeout(() => controller.abort(new Error("NDR watch deadline exceeded")), 55_000);
  let recovering = false;
  let locked = false;
  let capped = false;
  async function bounded<T>(operation: () => Promise<T>): Promise<T> {
    const remaining = (recovering ? 60_000 : 55_000) - (Date.now() - started);
    if (remaining <= 0) throw new Error("NDR watch deadline exceeded");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("NDR watch deadline exceeded")), remaining);
      })]);
    } finally { clearTimeout(timer); }
  }
  const original = deps;
  deps = {
    readState: () => bounded(() => original.readState()),
    initialize: now => bounded(() => original.initialize(now)),
    lock: () => bounded(() => original.lock()),
    unlock: () => bounded(() => original.unlock()),
    saveState: state => bounded(() => original.saveState(state)),
    known: id => bounded(() => original.known(id)),
    saveAlert: (alert, at) => bounded(() => original.saveAlert(alert, at)),
    collect: (since, at) => bounded(() => original.collect(since, at, controller.signal)),
    send: body => bounded(() => original.send(body)),
  };
  try {
    if (!dryRun) {
      locked = await deps.lock();
      if (!locked) return { ok: true, skipped: true, alerts: [] };
    }
    const state = await deps.readState() ?? (dryRun ? { started_at: timestamp, last_run_at: null, outage: false, outage_notified: false } : await deps.initialize(timestamp));
    try {
      const since = windowStart(state);
      const earliest = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
      capped = Date.parse(since) < Date.parse(earliest);
      const found = await deps.collect(capped ? earliest : since, state.started_at);
      const alerts: Alert[] = [];
      for (const alert of found) {
        if (Date.parse(alert.received_at) < Date.parse(state.started_at) || alerts.some(a => a.message_id === alert.message_id) || await deps.known(alert.message_id)) continue;
        if (!dryRun) {
          await deps.send(formatAlert(alert));
          await deps.saveAlert(alert, timestamp);
        }
        alerts.push(alert);
      }
      if (!dryRun) {
        // Chatwork 障害中に出せなかった障害通知は、復旧後に順番に届ける。
        if (state.outage && !state.outage_notified) {
          await deps.send(outageMessage("Chatwork に知らせを送れなかったため、遅れて届いています。", state.last_run_at));
          state.outage_notified = true;
          await deps.saveState(state);
        }
        if (state.outage) await deps.send(recoveryMessage(state.last_run_at, timestamp, alerts.length, capped));
        await deps.saveState({ ...state, last_run_at: timestamp, outage: false, outage_notified: false });
      }
      return { ok: true, dryRun, alerts, ...(capped ? { window_capped: true } : {}) };
    } catch (error) {
      recovering = true;
      if (!dryRun) {
        state.outage = true;
        await deps.saveState(state);
        if (!state.outage_notified) {
          try { await deps.send(outageMessage(outageReason(error), state.last_run_at)); }
          catch { return { ok: false, error: "メール送信失敗の監視に失敗しました" }; }
          state.outage_notified = true;
          await deps.saveState(state);
        }
      }
      return { ok: false, error: "メール送信失敗の監視に失敗しました" };
    }
  } catch {
    return { ok: false, error: "メール送信失敗の監視に失敗しました", ...(capped ? { window_capped: true } : {}) };
  } finally {
    clearTimeout(workTimer);
    controller.abort();
    recovering = true;
    if (locked) { try { await deps.unlock(); } catch { /* Storage lease expires independently. */ } }
  }
}
