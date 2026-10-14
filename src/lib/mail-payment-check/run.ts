/**
 * 支払漏れチェック（平日 10:00・Vercel cron）。
 * 24 箱のメール（直近 45 日）→ 支払う請求書だけ → 予約（振込依頼）・保存（Drive）と突き合わせ → 要対応だけ Chatwork へ。
 * 要対応・人の確認・読めない箱が無い日は送らない（月曜だけ「異常なし」）。失敗は障害ごとに 1 回＋回復時 1 回。
 */
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { addDays, isBusinessDay, parseDate, previousBusinessDay, todayJst } from "@/lib/pl-payments/business-day";

import { MAILBOXES } from "./classify";
import { fetchMailboxMessages, type MailFetchResult } from "./graph-mail";
import { judgeMails, type JudgeCounts, type JudgedItem } from "./judge";
import { LiveLookups, type Lookups } from "./lookups";
import { allClearMessage, ChatworkNotifier, failureMessage, recoveryMessage, reportMessage, type Notifier } from "./notify";

const LOOKBACK_DAYS = 45;

export type RunRow = { ran_at: string; ok: boolean; applied: boolean };

export type RunRepository = {
  lastApplied(): Promise<RunRow | null>;
  lastAppliedOk(): Promise<RunRow | null>;
  insert(row: { trigger: string; applied: boolean; ok: boolean; error?: string | null; counts?: unknown; items?: unknown }): Promise<void>;
};

export class SupabaseRunRepository implements RunRepository {
  private readonly db = getSupabaseAdmin();

  async lastApplied(): Promise<RunRow | null> {
    const { data, error } = await this.db
      .from("system_mail_payment_check_runs")
      .select("ran_at, ok, applied")
      .eq("applied", true)
      .order("ran_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return (data?.[0] as RunRow | undefined) ?? null;
  }

  async lastAppliedOk(): Promise<RunRow | null> {
    const { data, error } = await this.db
      .from("system_mail_payment_check_runs")
      .select("ran_at, ok, applied")
      .eq("applied", true)
      .eq("ok", true)
      .order("ran_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return (data?.[0] as RunRow | undefined) ?? null;
  }

  async insert(row: Parameters<RunRepository["insert"]>[0]): Promise<void> {
    const { error } = await this.db.from("system_mail_payment_check_runs").insert(row);
    if (error) throw error;
  }
}

export type RunDeps = {
  now?: Date;
  repo?: RunRepository;
  notifier?: Notifier;
  lookups?: Lookups;
  fetchMails?: (sinceIso: string) => Promise<MailFetchResult>;
};

export type RunOptions = { apply: boolean; trigger: "cron" | "manual"; force?: boolean };

export type RunResult = {
  ok: boolean;
  applied: boolean;
  today: string;
  skipped?: string;
  newSince?: string;
  counts?: JudgeCounts;
  notified?: boolean;
  message?: string;
  items?: JudgedItem[];
  failedMailboxes?: MailFetchResult["failedMailboxes"];
  error?: string;
};

/** 前回のチェックが無いときの「新着」の起点＝前の営業日の 10:00（日本時間） */
export function defaultNewSince(today: string): string {
  return `${previousBusinessDay(today)}T01:00:00.000Z`;
}

export async function runMailPaymentCheck(options: RunOptions, deps: RunDeps = {}): Promise<RunResult> {
  const now = deps.now ?? new Date();
  const today = todayJst(now);
  if (!options.force && !isBusinessDay(today)) return { ok: true, applied: false, today, skipped: "休みの日" };

  const repo = deps.repo ?? new SupabaseRunRepository();
  let notifier: Notifier | null = deps.notifier ?? null;
  const getNotifier = () => (notifier ??= new ChatworkNotifier());

  let previous: RunRow | null = null;
  try {
    previous = await repo.lastApplied();
    const lastOk = await repo.lastAppliedOk();
    const newSince = lastOk ? new Date(lastOk.ran_at).toISOString() : defaultNewSince(today);
    const since = `${addDays(today, -LOOKBACK_DAYS)}T00:00:00Z`;

    const fetched = await (deps.fetchMails ?? fetchMailboxMessages)(since);
    if (fetched.failedMailboxes.length >= MAILBOXES.length) {
      throw new Error(`受信箱を 1 つも読めません（${fetched.failedMailboxes[0].error}）`);
    }

    const { items, counts } = await judgeMails({ mails: fetched.items, today, newSince, lookups: deps.lookups ?? new LiveLookups(today) });
    const hasNews = counts.action > 0 || counts.human > 0 || fetched.failedMailboxes.length > 0;
    const isMonday = parseDate(today).getUTCDay() === 1;
    const message = hasNews
      ? reportMessage({ today, items, counts, failedMailboxes: fetched.failedMailboxes })
      : isMonday
        ? allClearMessage(today, counts)
        : undefined;

    if (options.apply) {
      if (previous && !previous.ok) await getNotifier().send(recoveryMessage());
      if (message) await getNotifier().send(message);
      await repo.insert({
        trigger: options.trigger,
        applied: true,
        ok: true,
        counts,
        items: items.filter((item) => item.kind !== "ok"),
      });
    }
    return {
      ok: true,
      applied: options.apply,
      today,
      newSince,
      counts,
      notified: options.apply && Boolean(message),
      message,
      items,
      failedMailboxes: fetched.failedMailboxes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.apply) {
      try {
        if (!previous || previous.ok) await getNotifier().send(failureMessage(message));
        await repo.insert({ trigger: options.trigger, applied: true, ok: false, error: message });
      } catch {
        // 記録や通知そのものに失敗しても、元の失敗を返す
      }
    }
    return { ok: false, applied: options.apply, today, error: message };
  }
}
