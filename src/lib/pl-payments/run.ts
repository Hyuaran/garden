import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { addDays, effectivePaymentDate, monthFromDate, nextBusinessDay, previousBusinessDay, todayJst } from "./business-day";
import { findInvoiceFile, type DriveLister } from "./drive-match";
import { fetchExecuteStatus, fetchWaitingPlRecords, taskSnapshot, updatePlDriveUrl, updatePlTransferId } from "./kintone-pl";
import {
  driveProblemMessage,
  failureMessage,
  newPaymentsMessage,
  recoveryMessage,
  reminderMessage,
  transferCreatedMessage,
  transferProblemMessage,
  unreservedMessage,
  ChatworkNotifier,
  type Notifier,
} from "./notify";
import { createTransfersForPayment, KintoneTransferClient, type TransferClient } from "./transfer";
import type { PaymentTaskRow, PlPaymentRecord, RunEvent } from "./types";

type DbClient = ReturnType<typeof getSupabaseAdmin>;

export type PlPaymentRepository = {
  listTasks(ids?: string[]): Promise<PaymentTaskRow[]>;
  listTransferTasks(): Promise<PaymentTaskRow[]>;
  upsertTask(row: PaymentTaskRow): Promise<void>;
  updateTask(id: string, patch: Partial<PaymentTaskRow>): Promise<void>;
};

export type RunDeps = {
  fetchRecords?: () => Promise<PlPaymentRecord[]>;
  repo?: PlPaymentRepository;
  notifier?: Notifier;
  transferClient?: TransferClient;
  driveLister?: DriveLister;
  updateDriveUrl?: (recordId: string, url: string) => Promise<void>;
  updateTransferId?: (recordId: string, transferId: string) => Promise<boolean>;
  fetchExecuteStatus?: (executeId: string) => Promise<string>;
  now?: Date;
};

export type RunOptions = {
  apply: boolean;
  trigger: "cron" | "daily";
};

export type RunResult = {
  ok: boolean;
  applied: boolean;
  trigger: string;
  today: string;
  counts: Record<string, number>;
  events: RunEvent[];
};

export class SupabasePlPaymentRepository implements PlPaymentRepository {
  constructor(private readonly db: DbClient = getSupabaseAdmin()) {}

  async listTasks(ids?: string[]): Promise<PaymentTaskRow[]> {
    let query = this.db.from("system_pl_payment_tasks").select("*");
    if (ids?.length) query = query.in("pl_record_id", ids);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PaymentTaskRow[];
  }

  async listTransferTasks(): Promise<PaymentTaskRow[]> {
    const { data, error } = await this.db
      .from("system_pl_payment_tasks")
      .select("*")
      .not("transfer_request_id", "is", null);
    if (error) throw error;
    return (data ?? []) as PaymentTaskRow[];
  }

  async upsertTask(row: PaymentTaskRow): Promise<void> {
    const { error } = await this.db.from("system_pl_payment_tasks").upsert(row, { onConflict: "pl_record_id" });
    if (error) throw error;
  }

  async updateTask(id: string, patch: Partial<PaymentTaskRow>): Promise<void> {
    const { error } = await this.db.from("system_pl_payment_tasks").update(patch).eq("pl_record_id", id);
    if (error) throw error;
  }
}

function asMap(rows: PaymentTaskRow[]): Map<string, PaymentTaskRow> {
  return new Map(rows.map((row) => [row.pl_record_id, row]));
}

function periodMonthFor(record: PlPaymentRecord): string {
  if (record.periodDate) return monthFromDate(record.periodDate);
  if (!record.dueDate) return "";
  const [year, month] = record.dueDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return monthFromDate(date.toISOString().slice(0, 10));
}

async function maybeSend(apply: boolean, notifier: Notifier, message: string, events: RunEvent[], type: string, recordId?: string) {
  events.push({ type, message, recordId });
  if (apply) await notifier.send(message);
}

/**
 * 接続の失敗は「障害ごとに 1 回＋回復時 1 回」だけ知らせる（INNOVERA番号の同期と同じ方針・Claude レビューで追加 2026-10-09）。
 * 状態は記録表の特別な行（pl_record_id = "_health:<名前>"）の last_error に持つ。
 */
async function withHealth(
  name: "cron" | "daily",
  options: RunOptions,
  repo: PlPaymentRepository,
  notifier: Notifier,
  body: () => Promise<RunResult>,
): Promise<RunResult> {
  const healthId = `_health:${name}`;
  const label = name === "cron" ? "5 分ごと" : "毎朝";
  try {
    const result = await body();
    if (options.apply) {
      const [health] = await repo.listTasks([healthId]);
      if (health?.last_error) {
        await notifier.send(recoveryMessage(label));
        await repo.updateTask(healthId, { last_error: null, notified_new_at: null });
      }
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.apply) {
      try {
        const [health] = await repo.listTasks([healthId]);
        if (!health?.last_error) {
          await notifier.send(failureMessage(label, message));
          await repo.upsertTask({ pl_record_id: healthId, last_error: message, notified_new_at: new Date().toISOString() });
        } else {
          await repo.updateTask(healthId, { last_error: message });
        }
      } catch {
        // 記録や通知そのものに失敗しても、元の失敗を返す
      }
    }
    return { ok: false, applied: options.apply, trigger: options.trigger, today: todayJst(), counts: {}, events: [{ type: "error", message }] };
  }
}

export async function runPlPaymentsCron(options: RunOptions, deps: RunDeps = {}): Promise<RunResult> {
  const repo = deps.repo ?? new SupabasePlPaymentRepository();
  const notifier = deps.notifier ?? new ChatworkNotifier({ dryRun: !options.apply });
  return withHealth("cron", options, repo, notifier, () => runPlPaymentsCronBody(options, { ...deps, repo, notifier }));
}

async function runPlPaymentsCronBody(options: RunOptions, deps: RunDeps = {}): Promise<RunResult> {
  const today = todayJst(deps.now);
  const repo = deps.repo ?? new SupabasePlPaymentRepository();
  const notifier = deps.notifier ?? new ChatworkNotifier({ dryRun: !options.apply });
  const transferClient = deps.transferClient ?? new KintoneTransferClient();
  const fetchRecords = deps.fetchRecords ?? fetchWaitingPlRecords;
  const updateDrive = deps.updateDriveUrl ?? updatePlDriveUrl;
  const updateTransfer = deps.updateTransferId ?? updatePlTransferId;
  const rootFolderId = process.env.PL_INVOICE_DRIVE_FOLDER_ID || "11ElkauoYT-ZmuxA1j3XRJC_yCzzJ4-SO";
  const events: RunEvent[] = [];
  const counts = { records: 0, newNotices: 0, driveMatched: 0, driveProblems: 0, transfers: 0, transferProblems: 0 };

  const records = await fetchRecords();
  counts.records = records.length;
  const existing = asMap(await repo.listTasks(records.map((record) => record.id)));
  const newPaymentRecords: PlPaymentRecord[] = [];

  for (const record of records) {
    const snapshot = taskSnapshot(record);
    const current = existing.get(record.id);
    const row: PaymentTaskRow = { ...current, ...snapshot };
    const isPaymentWaiting = record.category.includes("支払待ち") && record.status === "支払待ち";
    const isNew = !current;

    if (isNew && isPaymentWaiting) {
      newPaymentRecords.push(record);
      row.notified_new_at = new Date().toISOString();
    }

    if (!record.driveUrl) {
      const periodMonth = periodMonthFor(record);
      const match = await findInvoiceFile({
        rootFolderId,
        vendor: record.vendor,
        periodMonth,
        listEntries: deps.driveLister,
      });
      if (match.status === "matched") {
        row.drive_url = match.url;
        row.drive_url_set_at = new Date().toISOString();
        row.drive_match_note = null;
        if (options.apply) await updateDrive(record.id, match.url);
        counts.driveMatched += 1;
        events.push({ type: "drive_matched", message: match.url, recordId: record.id });
      } else if (row.drive_match_note !== match.note) {
        row.drive_match_note = match.note;
        counts.driveProblems += 1;
        await maybeSend(options.apply, notifier, driveProblemMessage(record, match.note), events, "drive_problem", record.id);
      }
    }

    if (isPaymentWaiting && (!row.transfer_request_id || !row.transfer_execute_id)) {
      const transfer = await createTransfersForPayment(
        { ...record, driveUrl: row.drive_url || record.driveUrl },
        transferClient,
        { apply: options.apply, today, existingRequestId: row.transfer_request_id, transferId: row.transfer_id },
      );
      if (transfer.note) {
        if (row.transfer_note !== transfer.note) {
          row.transfer_note = transfer.note;
          counts.transferProblems += 1;
          await maybeSend(options.apply, notifier, transferProblemMessage(record, transfer.note), events, "transfer_problem", record.id);
        }
      } else {
        row.transfer_request_id = transfer.requestId ?? row.transfer_request_id ?? null;
        row.transfer_execute_id = transfer.executeId ?? row.transfer_execute_id ?? null;
        row.transfer_id = transfer.transferId;
        row.transfer_created_at = new Date().toISOString();
        row.transfer_note = null;
        counts.transfers += 1;
        await maybeSend(
          options.apply,
          notifier,
          transferCreatedMessage(record, transfer, snapshot.effective_due_date ?? effectivePaymentDate(record.dueDate)),
          events,
          "transfer_created",
          record.id,
        );
        if (options.apply && transfer.transferId) await updateTransfer(record.id, transfer.transferId);
      }
    }

    if (options.apply) await repo.upsertTask(row);
    else events.push({ type: "upsert_planned", message: record.id, recordId: record.id });
  }

  if (newPaymentRecords.length) {
    counts.newNotices = newPaymentRecords.length;
    await maybeSend(options.apply, notifier, newPaymentsMessage(newPaymentRecords), events, "new_payment_notice");
  }

  return { ok: true, applied: options.apply, trigger: options.trigger, today, counts, events };
}

export async function runPlPaymentsDaily(options: RunOptions, deps: RunDeps = {}): Promise<RunResult> {
  const repo = deps.repo ?? new SupabasePlPaymentRepository();
  const notifier = deps.notifier ?? new ChatworkNotifier({ dryRun: !options.apply });
  return withHealth("daily", options, repo, notifier, () => runPlPaymentsDailyBody(options, { ...deps, repo, notifier }));
}

async function runPlPaymentsDailyBody(options: RunOptions, deps: RunDeps = {}): Promise<RunResult> {
  const today = todayJst(deps.now);
  const tomorrowBusiness = nextBusinessDay(today);
  const repo = deps.repo ?? new SupabasePlPaymentRepository();
  const notifier = deps.notifier ?? new ChatworkNotifier({ dryRun: !options.apply });
  const statusReader = deps.fetchExecuteStatus ?? fetchExecuteStatus;
  const rows = await repo.listTransferTasks();
  const events: RunEvent[] = [];
  const counts = { reminders: 0, unreservedAlerts: 0 };

  // 明日が期日のもの。振込実行がすでに「完了」（予約済み）のものは知らせない（Claude レビューで追加 2026-10-09）
  const reminderCandidates = rows.filter(
    (row) => row.effective_due_date === tomorrowBusiness && row.reminder_sent_on !== today,
  );
  const reminders: PaymentTaskRow[] = [];
  for (const row of reminderCandidates) {
    const status = row.transfer_execute_id ? await statusReader(row.transfer_execute_id) : "";
    if (status !== "完了") reminders.push(row);
  }
  if (reminders.length) {
    counts.reminders = reminders.length;
    await maybeSend(options.apply, notifier, reminderMessage(tomorrowBusiness, reminders), events, "reminder");
    if (options.apply) {
      await Promise.all(reminders.map((row) => repo.updateTask(row.pl_record_id, { reminder_sent_on: today })));
    }
  }

  const dueToday = rows.filter(
    (row) =>
      row.effective_due_date &&
      previousBusinessDay(row.effective_due_date) === today &&
      row.unreserved_alert_sent_on !== today,
  );
  const unreserved: Array<PaymentTaskRow & { executeStatus?: string }> = [];
  for (const row of dueToday) {
    if (!row.transfer_execute_id) continue;
    const status = await statusReader(row.transfer_execute_id);
    if (status !== "完了") unreserved.push({ ...row, executeStatus: status });
  }
  if (unreserved.length) {
    const date = unreserved[0].effective_due_date || addDays(today, 1);
    counts.unreservedAlerts = unreserved.length;
    await maybeSend(options.apply, notifier, unreservedMessage(date, unreserved), events, "unreserved");
    if (options.apply) {
      await Promise.all(unreserved.map((row) => repo.updateTask(row.pl_record_id, { unreserved_alert_sent_on: today })));
    }
  }

  return { ok: true, applied: options.apply, trigger: options.trigger, today, counts, events };
}
