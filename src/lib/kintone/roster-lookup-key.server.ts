/**
 * Kintone の経費（95）・交通費（93）・口座一覧（92）は、従業員名簿（56）の KOTID（文字列__1行__5）で人を探す。
 * KOTID は打刻ID と同じ番号の人のほかに「r923＋番号」「99999-1」の人もいる（名簿を書き換えると
 * 92・93 の既存の行が保存し直せなくなるので、名簿はそのままにして送る側で合わせる・2026-11-10）。
 * 名簿の KOTID を読めたらその値、読めなければ打刻ID をそのまま返す。
 */
const KOTID = "文字列__1行__5";
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

export async function rosterLookupKey(kotId: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const sub = process.env.KINTONE_SUBDOMAIN, token = process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN;
  const app = process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID || "56";
  const number = digits(kotId);
  if (!sub || !token || !number) return kotId;
  try {
    // 打刻ID に前後の空白が入った行もあるので like で拾い、数字だけで照らし合わせる
    const params = new URLSearchParams({ app, query: `打刻ID like "${number}" order by 作成日時 desc limit 20`, "fields[0]": "打刻ID", "fields[1]": KOTID });
    const response = await fetchImpl(`https://${sub}.cybozu.com/k/v1/records.json?${params}`, {
      headers: { "X-Cybozu-API-Token": token }, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return kotId;
    const records = ((await response.json()) as { records?: Record<string, { value?: unknown }>[] }).records ?? [];
    const key = records.map(row => String(row[KOTID]?.value ?? "").trim()).find((value, index) => value && digits(records[index].打刻ID?.value) === number);
    return key || kotId;
  } catch {
    return kotId;
  }
}
