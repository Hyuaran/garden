import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { addDays, isBusinessDay, parseDate, todayJst } from "@/lib/pl-payments/business-day";
import { fetchMailboxMessages, fetchMessageAttachments, fetchMessageAttachmentContent, getGraphToken, type MailFetchResult } from "../mail-payment-check/graph-mail";
import type { RunOptions, RunRow, RunRepository } from "../mail-payment-check/run";
import { buildDriveIndex } from "./drive-index";
import { judgeMails, type JudgeDeps } from "./judge";
import { ChatworkNotifier, allClearMessage, reportMessage, failureMessage, recoveryMessage, type Notifier } from "./notify";
import { createSaver } from "./save";

export type DocRepository = Pick<RunRepository, "lastApplied" | "insert"> & {
  wasSaved(md5: string): Promise<boolean>;
  record: NonNullable<JudgeDeps["record"]>;
};
export class SupabaseDocRepository implements DocRepository {
  private readonly db = getSupabaseAdmin();
  async lastApplied(): Promise<RunRow | null> {
    const { data, error } = await this.db.from("system_doc_save_runs").select("ran_at,ok,applied").eq("applied", true).order("ran_at", { ascending: false }).limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  }
  async insert(row: Parameters<RunRepository["insert"]>[0]) {
    const { error } = await this.db.from("system_doc_save_runs").insert(row);
    if (error) throw error;
  }
  async wasSaved(md5: string) {
    const { data, error } = await this.db.from("system_doc_saved_files").select("md5").eq("md5", md5).limit(1);
    if (error) throw error;
    return Boolean(data?.length);
  }
  async record(item: Parameters<NonNullable<JudgeDeps["record"]>>[0], file: { id: string; url: string; fileName: string }) {
    const { error } = await this.db.from("system_doc_saved_files").insert({ md5: item.md5, kind: item.kind, root_folder_id: item.rootFolderId, drive_file_id: file.id, drive_url: file.url, message_id: item.mail.internetMessageId, mailbox: item.mail.mailboxes[0], file_name: file.fileName });
    if (error) throw error;
  }
}
export type RunDeps = {
  now?: Date; repo?: DocRepository; notifier?: Notifier;
  fetchMails?: (since: string) => Promise<MailFetchResult>;
  attachments?: JudgeDeps["attachments"]; content?: JudgeDeps["content"]; index?: JudgeDeps["index"]; save?: JudgeDeps["save"];
};
export async function runDocSaveCheck(options: RunOptions, deps: RunDeps = {}) {
  const today = todayJst(deps.now ?? new Date());
  if (!options.force && !isBusinessDay(today)) return { ok: true, applied: false, today, skipped: "休みの日" };
  let previous: RunRow | null = null;
  let repo: DocRepository | undefined;
  const notifier = deps.notifier ?? new ChatworkNotifier();
  try {
    repo = deps.repo ?? new SupabaseDocRepository();
    previous = await repo.lastApplied();
    const fetched = await (deps.fetchMails ?? (since => fetchMailboxMessages(since, undefined, true)))(`${addDays(today, -45)}T00:00:00+09:00`);
    if (fetched.failedMailboxes.length) throw new Error(`読めなかったメールボックス：${fetched.failedMailboxes.map(m => `${m.mailbox}（${m.error}）`).join("、")}`);
    let token: string | undefined;
    const autosave = options.apply && process.env.DOC_SAVE_CHECK_AUTOSAVE === "on";
    const { items, counts } = await judgeMails(fetched.items, {
      attachments: deps.attachments ?? (async mail => {
        token ??= await getGraphToken();
        const mailbox = mail.mailboxes[0];
        return fetchMessageAttachments(mailbox, mail.messageIdsByMailbox?.[mailbox] ?? mail.id, token);
      }),
      content: deps.content ?? (async (mail, attachment) => {
        token ??= await getGraphToken();
        const mailbox = mail.mailboxes[0];
        return fetchMessageAttachmentContent(mailbox, mail.messageIdsByMailbox?.[mailbox] ?? mail.id, attachment.id, token);
      }),
      index: deps.index ?? buildDriveIndex,
      wasSaved: md5 => repo!.wasSaved(md5),
      ...(autosave ? { save: deps.save ?? createSaver(), record: (item, file) => repo!.record(item, file) } : {}),
    });
    const message = counts.missing || counts.autosaved ? reportMessage(today, items, counts) : parseDate(today).getUTCDay() === 1 ? allClearMessage(today) : undefined;
    if (options.apply) {
      if (previous && !previous.ok) await notifier.send(recoveryMessage());
      if (message) await notifier.send(message);
      await repo.insert({ trigger: options.trigger, applied: true, ok: true, counts, items });
    }
    return { ok: true, applied: options.apply, today, counts, items, message, notified: options.apply && Boolean(message) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.apply) {
      try {
        if (!previous || previous.ok) await notifier.send(failureMessage(message));
        await repo?.insert({ trigger: options.trigger, applied: true, ok: false, error: message });
      } catch { /* 元の失敗を返す */ }
    }
    return { ok: false, applied: options.apply, today, error: message };
  }
}
