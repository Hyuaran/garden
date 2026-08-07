import "server-only";

export type KintoneFieldValue = { value: string | string[] | number | null };
export type KintoneRecord = Record<string, KintoneFieldValue>;

type RecordsResponse = { records: KintoneRecord[]; totalCount?: string | null };
type AddRecordResponse = { id: string; revision: string };

export function kintoneHost(): string {
  const raw = process.env.KINTONE_SUBDOMAIN?.trim().toLowerCase();
  if (!raw) throw new Error("KINTONE_SUBDOMAIN が未設定です");
  const subdomain = raw.replace(/\.cybozu\.com$/, "");
  if (!/^[a-z0-9-]+$/.test(subdomain)) throw new Error("KINTONE_SUBDOMAIN が不正です");
  return `https://${subdomain}.cybozu.com`;
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  if (!token) throw new Error("Kintone APIトークンが未設定です");
  // Content-Type: application/json は body があるとき（POST）だけ付ける。
  // GET に付けると Kintone がクエリを body から読もうとし URL クエリを無視して
  // CB_IL02「Invalid request.」になる（実データで確認・2026-08-08）。
  const headers: Record<string, string> = {
    "X-Cybozu-API-Token": token,
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${kintoneHost()}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) throw new Error(body.message || `Kintone APIエラー (${response.status})`);
  return body as T;
}

export async function getRecords(appId: string, token: string, query: string) {
  const params = new URLSearchParams({ app: appId, query, totalCount: "true" });
  return request<RecordsResponse>(`/k/v1/records.json?${params}`, token);
}

export async function addRecord(appId: string, token: string, record: KintoneRecord) {
  return request<AddRecordResponse>("/k/v1/record.json", token, {
    method: "POST",
    body: JSON.stringify({ app: appId, record }),
  });
}
