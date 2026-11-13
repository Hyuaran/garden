import type { Alert } from "./parse";
import { formatAlert } from "./parse";
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
          await deps.send("送信失敗の見張りが止まっています");
          state.outage_notified = true;
          await deps.saveState(state);
        }
        if (state.outage) await deps.send("復旧しました");
        await deps.saveState({ ...state, last_run_at: timestamp, outage: false, outage_notified: false });
      }
      return { ok: true, dryRun, alerts, ...(capped ? { window_capped: true } : {}) };
    } catch {
      recovering = true;
      if (!dryRun) {
        state.outage = true;
        await deps.saveState(state);
        if (!state.outage_notified) {
          try { await deps.send("送信失敗の見張りが止まっています"); }
          catch { return { ok: false, error: "メール送信失敗の監視に失敗しました" }; }
          state.outage_notified = true;
          await deps.saveState(state);
        }
      }
      return { ok: false, error: "メール送信失敗の監視に失敗しました" };
    }
  } catch {
    return { ok: false, error: "?????????????????", ...(capped ? { window_capped: true } : {}) };
  } finally {
    clearTimeout(workTimer);
    controller.abort();
    recovering = true;
    if (locked) { try { await deps.unlock(); } catch { /* Storage lease expires independently. */ } }
  }
}
