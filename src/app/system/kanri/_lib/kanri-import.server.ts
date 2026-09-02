import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAllRecords, type KintoneRecord } from "@/lib/kintone/records";
import {
  buildCreditCondition,
  buildCustomerCondition,
  buildKandenCondition,
  buildRosterCondition,
  buildWarnings,
  CREDIT_FIELDS,
  CUSTOMER_FIELDS,
  dedupeRows,
  KANDEN_FIELDS,
  type KanriMode,
  type KanriSource,
  type KanriSourceRow,
  type KanriWarning,
  recordId,
  ROSTER_FIELDS,
  sourceEmptyWarning,
  sourceFailedWarning,
  summarizeRows,
} from "./kanri-core";

type FetchOutcome = {
  source: KanriSource;
  sourceApp: string | null;
  records: KintoneRecord[];
  ok: boolean;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_missing`);
  return value;
}

function creditApps() {
  return (process.env.KINTONE_KANRI_CREDIT_APPS ?? "66,84,89,91,94,96,229,230")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function fetchSource(
  source: KanriSource,
  sourceApp: string | null,
  app: string,
  token: string,
  condition: string,
  fields: readonly string[],
): Promise<FetchOutcome> {
  const records = await getAllRecords(app, token, condition, fields);
  return { source, sourceApp, records, ok: true };
}

async function safeFetch(
  source: KanriSource,
  sourceApp: string | null,
  app: string,
  token: string,
  condition: string,
  fields: readonly string[],
): Promise<FetchOutcome> {
  try {
    return await fetchSource(source, sourceApp, app, token, condition, fields);
  } catch {
    return { source, sourceApp, records: [], ok: false };
  }
}

async function safeFetchEnv(
  source: KanriSource,
  sourceApp: string | null,
  appName: string,
  tokenName: string,
  condition: string,
  fields: readonly string[],
): Promise<FetchOutcome> {
  try {
    return await safeFetch(source, sourceApp, requiredEnv(appName), requiredEnv(tokenName), condition, fields);
  } catch {
    return { source, sourceApp, records: [], ok: false };
  }
}

async function safeFetchCredit(app: string, targetDate: string): Promise<FetchOutcome> {
  try {
    return await safeFetch(
      "credit_card",
      app,
      app,
      requiredEnv(`KINTONE_KANRI_CREDIT_TOKEN_${app}`),
      buildCreditCondition(targetDate),
      CREDIT_FIELDS,
    );
  } catch {
    return { source: "credit_card", sourceApp: app, records: [], ok: false };
  }
}

function rowsFromOutcome(outcome: FetchOutcome): KanriSourceRow[] {
  return outcome.records.map((record) => ({
    source: outcome.source,
    sourceApp: outcome.sourceApp,
    recordId: recordId(record),
    payload: record,
  }));
}

export async function collectKanriRows(targetDate: string) {
  const customer = await safeFetchEnv(
    "kintone_customer",
    null,
    "KINTONE_KANRI_CUSTOMER_APP_ID",
    "KINTONE_KANRI_CUSTOMER_TOKEN",
    buildCustomerCondition(targetDate),
    CUSTOMER_FIELDS,
  );
  const kanden = await safeFetchEnv(
    "kanden_report",
    null,
    "KINTONE_KANRI_KANDEN_REPORT_APP_ID",
    "KINTONE_KANRI_KANDEN_REPORT_TOKEN",
    buildKandenCondition(targetDate),
    KANDEN_FIELDS,
  );
  const roster = await safeFetchEnv(
    "roster",
    null,
    "KINTONE_EMPLOYEE_ROSTER_APP_ID",
    "KINTONE_EMPLOYEE_ROSTER_TOKEN",
    buildRosterCondition(targetDate),
    ROSTER_FIELDS,
  );
  const credit = await Promise.all(creditApps().map((app) => safeFetchCredit(app, targetDate)));

  const outcomes = [customer, kanden, ...credit, roster];
  const warnings: KanriWarning[] = [];
  outcomes.forEach((outcome) => {
    if (!outcome.ok) warnings.push(sourceFailedWarning(outcome.source, outcome.sourceApp ?? undefined));
    else if (outcome.records.length === 0) warnings.push(sourceEmptyWarning(outcome.source, outcome.sourceApp ?? undefined));
  });

  const rows = outcomes.flatMap(rowsFromOutcome);
  const allFailed = outcomes.every((outcome) => !outcome.ok);
  const dedupedRows = dedupeRows(rows);
  return {
    rows: dedupedRows,
    summary: summarizeRows(dedupedRows),
    warnings: buildWarnings(rows, warnings),
    status: allFailed ? "failed" as const : "fetched" as const,
    errorCode: allFailed ? "all_sources_failed" : null,
  };
}

export async function createKanriRun(input: {
  targetDate: string;
  mode: KanriMode;
  userId: string;
  creatorName: string;
}) {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: run, error: createError } = await admin
    .from("system_kanri_run")
    .insert({
      target_date: input.targetDate,
      mode: input.mode,
      created_by: input.userId,
      creator_name: input.creatorName,
      status: "fetching",
      started_at: now,
    })
    .select("id")
    .single();
  if (createError || !run?.id) throw new Error("run_create_failed");

  const result = await collectKanriRows(input.targetDate);
  if (result.rows.length > 0) {
    const { error: rowError } = await admin.from("system_kanri_source_row").insert(
      result.rows.map((row) => ({
        run_id: run.id,
        source: row.source,
        source_app: row.sourceApp,
        record_id: row.recordId,
        payload: row.payload,
      })),
    );
    if (rowError) {
      result.status = "failed";
      result.errorCode = "source_row_save_failed";
    }
  }

  const { error: updateError } = await admin
    .from("system_kanri_run")
    .update({
      status: result.status,
      summary: result.summary,
      warnings: result.warnings,
      error_code: result.errorCode,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id);
  if (updateError) throw new Error("run_update_failed");

  return {
    ok: result.status !== "failed",
    runId: run.id as string,
    status: result.status,
    summary: result.summary,
    warnings: result.warnings,
  };
}
