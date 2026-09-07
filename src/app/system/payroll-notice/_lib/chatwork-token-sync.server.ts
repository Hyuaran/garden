import "server-only";

import { encryptToken, decryptToken } from "@/app/rill/mail/_lib/token-crypto";
import { getChatworkMe } from "@/app/system/_lib/chatwork";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type TokenSyncReason = "format" | "chatwork" | "root" | "retired" | "roster";

export type TokenSyncPerson = {
  employeeNumber: string;
  name: string;
  kotEmployeeId: string;
};

export type TokenSyncSummary = {
  imported: number;
  created: number;
  unchanged: number;
  invalidFormat: TokenSyncPerson[];
  rejectedByChatwork: TokenSyncPerson[];
  missingRoot: TokenSyncPerson[];
  retired: number;
  rosterMissing: TokenSyncPerson[];
};

export type TokenSyncResult = TokenSyncSummary & {
  ok: true;
  syncedAt: string;
};

type KintoneRecord = {
  "文字列__1行__1"?: { value?: unknown };
  "打刻ID"?: { value?: unknown };
  "社員番号"?: { value?: unknown };
  "従業員名_姓名"?: { value?: unknown };
  "従業員ステータス"?: { value?: unknown };
};

type RootEmployeeTokenRow = {
  employee_id: string;
  employee_number: string | null;
  name: string;
  kot_employee_id: string | null;
  chatwork_api_token_enc: string | null;
};

const CHATWORK_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export function isValidChatworkApiToken(value: string) {
  return CHATWORK_TOKEN_PATTERN.test(value);
}

export function emptyTokenSyncSummary(): TokenSyncSummary {
  return {
    imported: 0,
    created: 0,
    unchanged: 0,
    invalidFormat: [],
    rejectedByChatwork: [],
    missingRoot: [],
    retired: 0,
    rosterMissing: [],
  };
}

function field(record: KintoneRecord, code: keyof KintoneRecord) {
  return String(record[code]?.value ?? "").trim();
}

function personFromRecord(record: KintoneRecord): TokenSyncPerson {
  return {
    employeeNumber: field(record, "社員番号"),
    name: field(record, "従業員名_姓名"),
    kotEmployeeId: field(record, "打刻ID"),
  };
}

function escapeQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function callKintoneRoster(token: string, app: string, query: string, fetchImpl: typeof fetch) {
  const subdomain = process.env.KINTONE_SUBDOMAIN;
  if (!subdomain || !token) throw new Error("Kintone環境変数未設定");
  const response = await fetchImpl(`https://${subdomain}.cybozu.com/k/v1/records.json`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Cybozu-API-Token": token,
      "X-HTTP-Method-Override": "GET",
    },
    body: JSON.stringify({
      app,
      query,
      fields: ["文字列__1行__1", "打刻ID", "社員番号", "従業員名_姓名", "従業員ステータス"],
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Kintone従業員名簿を読めませんでした (${response.status})`);
  const json = await response.json() as { records?: KintoneRecord[] };
  return Array.isArray(json.records) ? json.records : [];
}

async function fetchRosterRecords(kotEmployeeId: string | undefined, fetchImpl: typeof fetch) {
  const token = process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN ?? "";
  const app = process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID || "56";
  const baseQuery = kotEmployeeId
    ? `打刻ID = "${escapeQueryValue(kotEmployeeId)}" and 文字列__1行__1 != ""`
    : '文字列__1行__1 != ""';
  return callKintoneRoster(token, app, `${baseQuery} limit 500`, fetchImpl);
}

function reasonFromSummary(summary: TokenSyncSummary): "名簿に登録なし" | "形式が違う" | "Chatwork が受け付けない" | "Root に打刻 ID なし" {
  if (summary.invalidFormat.length > 0) return "形式が違う";
  if (summary.rejectedByChatwork.length > 0) return "Chatwork が受け付けない";
  if (summary.missingRoot.length > 0) return "Root に打刻 ID なし";
  return "名簿に登録なし";
}

export function getSingleTokenSyncReason(summary: TokenSyncSummary) {
  return reasonFromSummary(summary);
}

export async function syncChatworkTokens({
  kotEmployeeId,
  fetchImpl = fetch,
}: {
  kotEmployeeId?: string | null;
  fetchImpl?: typeof fetch;
} = {}): Promise<TokenSyncResult> {
  const summary = emptyTokenSyncSummary();
  const records = await fetchRosterRecords(kotEmployeeId || undefined, fetchImpl);
  if (kotEmployeeId && records.length === 0) {
    summary.rosterMissing.push({ employeeNumber: "", name: "", kotEmployeeId });
  }

  const admin = getSupabaseAdmin();
  const { data: roots, error } = await admin
    .from("root_employees")
    .select("employee_id,employee_number,name,kot_employee_id,chatwork_api_token_enc")
    .is("deleted_at", null);
  if (error) throw new Error("Root 従業員マスタを読めませんでした");

  const rootByKot = new Map<string, RootEmployeeTokenRow>();
  for (const root of (roots ?? []) as RootEmployeeTokenRow[]) {
    if (root.kot_employee_id) rootByKot.set(root.kot_employee_id, root);
  }

  for (const record of records) {
    const token = field(record, "文字列__1行__1");
    const person = personFromRecord(record);
    if (field(record, "従業員ステータス") !== "在籍中") {
      summary.retired += 1;
      continue;
    }
    if (!isValidChatworkApiToken(token)) {
      summary.invalidFormat.push(person);
      continue;
    }
    const root = rootByKot.get(person.kotEmployeeId);
    if (!root) {
      summary.missingRoot.push(person);
      continue;
    }

    let accountName: string;
    try {
      accountName = (await getChatworkMe(token, fetchImpl)).name;
    } catch {
      summary.rejectedByChatwork.push(person);
      continue;
    }

    let unchanged = false;
    if (root.chatwork_api_token_enc) {
      try {
        unchanged = decryptToken(root.chatwork_api_token_enc) === token;
      } catch {
        unchanged = false;
      }
    }

    if (unchanged) {
      summary.imported += 1;
      summary.unchanged += 1;
      continue;
    }

    const { error: updateError } = await admin
      .from("root_employees")
      .update({
        chatwork_api_token_enc: encryptToken(token),
        chatwork_account_name: accountName,
        chatwork_token_updated_at: new Date().toISOString(),
      })
      .eq("employee_id", root.employee_id);
    if (updateError) throw new Error("Chatwork トークンを保存できませんでした");
    summary.imported += 1;
    if (!root.chatwork_api_token_enc) summary.created += 1;
  }

  return { ok: true, syncedAt: new Date().toISOString(), ...summary };
}
