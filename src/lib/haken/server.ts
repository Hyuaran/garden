import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { requireViewEmployee } from "@/lib/auth/system-view-api.server";
import { canDeleteWorker, todayJst, validDate } from "./rules";
import { DEFAULT_FIELDS, PARTY_FIELDS, type HakenData } from "./types";

export class HakenError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function hakenContext(write = false) {
  const employee = await requireViewEmployee("system-haken", "", "manager");
  if (!employee) throw new HakenError("権限がありません。", 403);
  if (write && !(await requireManager()))
    throw new HakenError("権限がありません。", 403);
  return { db: getSupabaseAdmin(), employee };
}
export function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error)
    throw new HakenError("保存・読み込みができませんでした。", 503);
  return result.data;
}
async function allHakenRows<T>(query: {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>;
}): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const page =
      checked(await query.range(offset, offset + pageSize - 1)) ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
export async function loadHakenData(
  db: ReturnType<typeof getSupabaseAdmin>,
): Promise<HakenData> {
  const results = await Promise.all([
    allHakenRows(
      db.from("system_haken_party").select("*").order("name").order("id"),
    ),
    allHakenRows(db.from("system_haken_office").select("*").order("id")),
    allHakenRows(
      db
        .from("system_haken_contract")
        .select("*")
        .eq("side", "ukeire")
        .order("id"),
    ),
    // 保存中の過去の契約も継続期間の計算に必要。
    allHakenRows(db.from("system_haken_worker").select("*").order("id")),
    allHakenRows(
      db
        .from("system_haken_document")
        .select("*")
        .is("deleted_at", null)
        .order("id"),
    ),
    allHakenRows(
      db
        .from("system_haken_event")
        .select("*")
        .is("deleted_at", null)
        .order("id"),
    ),
    allHakenRows(
      db
        .from("root_employees")
        .select("employee_id,name,haken_party_id")
        .is("deleted_at", null)
        .order("name")
        .order("employee_id"),
    ),
    allHakenRows(
      db
        .from("root_companies")
        .select("company_id,company_name")
        .eq("is_active", true)
        .order("company_id"),
    ),
  ]);
  const [
    parties,
    offices,
    contracts,
    workers,
    documents,
    events,
    employees,
    companies,
  ] = results;
  return {
    parties,
    offices,
    contracts,
    workers,
    documents,
    events,
    employees,
    companies,
  } as HakenData;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HakenError("入力内容を確認してください。");
  return value as Record<string, unknown>;
}
export function text(
  raw: Record<string, unknown>,
  key: string,
  required = false,
  max = 3000,
): string {
  const value = raw[key] ?? "";
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new HakenError("入力内容を確認してください。");
  return value.trim();
}
export function date(
  raw: Record<string, unknown>,
  key: string,
  required = false,
): string | null {
  const value = text(raw, key, required, 10);
  if (value && !validDate(value))
    throw new HakenError("日付を確認してください。");
  return value || null;
}
const boolean = (raw: Record<string, unknown>, key: string) => {
  if (raw[key] !== undefined && typeof raw[key] !== "boolean")
    throw new HakenError("選択内容を確認してください。");
  return raw[key] === true;
};
export async function mutateHaken(
  raw: unknown,
  context?: Awaited<ReturnType<typeof hakenContext>>,
) {
  const { db, employee } = context ?? (await hakenContext(true));
  const body = object(raw);
  const kind = text(body, "kind", true);
  const value = object(body.value);
  const id = text(value, "id") || undefined;
  const stamp = {
    updated_at: new Date().toISOString(),
    updated_by: employee.userId,
  };
  if (kind === "party") {
    const values: Record<string, unknown> = { ...stamp };
    for (const [key] of PARTY_FIELDS)
      values[key] =
        key === "basic_contract_on"
          ? date(value, key)
          : text(
              value,
              key,
              key === "name",
              key === "note" ? 5000 : key === "address" ? 1000 : 200,
            );
    const delivery = text(value, "invoice_delivery");
    if (!["mail", "portal"].includes(delivery))
      throw new HakenError("請求書の届き方を選んでください。");
    values.invoice_delivery = delivery;
    const defaults = object(value.issue_defaults ?? {});
    values.issue_defaults = Object.fromEntries(
      ["office_id", ...DEFAULT_FIELDS.map(([key]) => key)].map((key) => [
        key,
        text(defaults, key, false, key === "questions" ? 10000 : 3000),
      ]),
    );
    return checked(
      await db
        .from("system_haken_party")
        .upsert({
          ...values,
          ...(id ? { id } : { created_by: employee.userId }),
        })
        .select()
        .single(),
    );
  }
  if (kind === "office") {
    const values = Object.fromEntries(
      [
        "company_id",
        "name",
        "address",
        "training_note",
        "cafeteria_note",
        "rest_room_note",
        "changing_room_note",
      ].map((key) => [
        key,
        text(value, key, ["name", "company_id"].includes(key)),
      ]),
    );
    return checked(
      await db
        .from("system_haken_office")
        .upsert({
          ...values,
          ...stamp,
          ...(id ? { id } : { created_by: employee.userId }),
        })
        .select()
        .single(),
    );
  }
  if (kind === "ledger") {
    const c = object(value.contract);
    const w = object(value.worker);
    const start = date(c, "period_start", true)!;
    const end = date(c, "period_end");
    if (end && end < start)
      throw new HakenError("終了日は開始日以降にしてください。");
    const contract: Record<string, unknown> = {
      ...stamp,
      side: "ukeire",
      period_start: start,
      period_end: end,
      notified_conflict_on: date(c, "notified_conflict_on"),
      is_introduction: boolean(c, "is_introduction"),
    };
    for (const key of [
      "party_id",
      "office_id",
      "org_unit",
      "work_content",
      "responsibility",
      "work_days",
      "work_hours",
      "break_note",
      "supervisor_name",
      "commander_name",
      "complaint_owner_name",
      "no_limit_reason",
    ])
      contract[key] = text(c, key, ["party_id", "office_id"].includes(key));
    const contractId = text(c, "id");
    const existing = contractId
      ? checked(
          await db
            .from("system_haken_contract")
            .select("id,side")
            .eq("id", contractId)
            .single(),
        )
      : null;
    if (existing && existing.side !== "ukeire")
      throw new HakenError("受け入れた人の契約を選んでください。");
    const workerId = text(w, "id");
    if (workerId) {
      const old = checked(
        await db
          .from("system_haken_worker")
          .select("contract_id,end_on")
          .eq("id", workerId)
          .single(),
      );
      if (!old || old.contract_id !== contractId)
        throw new HakenError("台帳を確認してください。");
      if (
        old.end_on &&
        !canDeleteWorker(old.end_on, todayJst()) &&
        (!end || end < old.end_on)
      )
        throw new HakenError("保存期限前の台帳は保存期間を短くできません。");
    }
    if (w.gender && !["male", "female"].includes(String(w.gender)))
      throw new HakenError("性別を選んでください。");
    const worker: Record<string, unknown> = {
      ...stamp,
      name: text(w, "name", true, 200),
      employee_id: text(w, "employee_id") || null,
      gender: text(w, "gender") || null,
      start_on: start,
      end_on: end,
      party_notice_on: date(w, "party_notice_on"),
      insurance_reason: text(w, "insurance_reason"),
      end_reason: text(w, "end_reason"),
    };
    for (const key of [
      "is_indefinite",
      "is_over_60",
      "is_agreement",
      "health_insurance",
      "pension",
      "employment_insurance",
    ])
      worker[key] = boolean(w, key);
    return checked(
      await db.rpc("save_haken_ledger", {
        p_contract: { ...contract, ...(contractId ? { id: contractId } : {}) },
        p_worker: { ...worker, ...(workerId ? { id: workerId } : {}) },
        p_actor: employee.userId,
      }),
    );
  }
  if (kind === "event") {
    const eventKind = text(value, "kind");
    if (!["training", "complaint"].includes(eventKind))
      throw new HakenError("区分を選んでください。");
    return checked(
      await db
        .from("system_haken_event")
        .insert({
          ...stamp,
          created_by: employee.userId,
          worker_id: text(value, "worker_id", true),
          kind: eventKind,
          on_date: date(value, "on_date", true),
          content: text(value, "content", true, 5000),
          handler: text(value, "handler"),
          result: text(value, "result"),
          party_contact: text(value, "party_contact"),
        })
        .select()
        .single(),
    );
  }
  if (kind === "delete-worker") {
    const worker = checked(
      await db
        .from("system_haken_worker")
        .select("end_on")
        .eq("id", id)
        .single(),
    );
    if (!worker || !canDeleteWorker(worker.end_on, todayJst()))
      throw new HakenError("派遣終了から3年間は台帳を削除できません。", 409);
    checked(
      await db
        .from("system_haken_worker")
        .update({ ...stamp, deleted_at: new Date().toISOString() })
        .eq("id", id),
    );
    return { id };
  }
  if (kind === "delete-document") {
    checked(
      await db
        .from("system_haken_document")
        .update({ ...stamp, deleted_at: new Date().toISOString() })
        .eq("id", id),
    );
    return { id };
  }
  throw new HakenError("操作を確認してください。");
}
export function hakenError(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof HakenError ? error.message : "処理できませんでした。",
    },
    { status: error instanceof HakenError ? error.status : 500 },
  );
}
