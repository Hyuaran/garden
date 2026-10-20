import type { ConnectedAccount, Transaction, TrialRow } from "./types";

// The only POST is token exchange. Accounting data is strictly GET-only.
export class MfClient {
  private token?: string;
  constructor(private key: string, private fetcher: typeof fetch = fetch) {}
  private async json(url: string, method: "GET" | "POST", token: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.fetcher(url, { method, headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error("MF response failed");
      return await response.json();
    } catch { throw new Error("MF に接続できませんでした"); }
  }
  async get(path: string, params: Record<string, string> = {}) {
    if (!this.token) {
      const auth = await this.json("https://api.biz.moneyforward.com/auth/exchange", "POST", this.key);
      if (typeof auth.access_token !== "string") throw new Error("MF に接続できませんでした");
      this.token = auth.access_token;
    }
    const url = new URL(`https://api-accounting.moneyforward.com/api/v3/${path}`);
    url.search = new URLSearchParams({ ...params, office_code: "2918-5520" }).toString();
    return this.json(url.toString(), "GET", this.token);
  }
  async accounts(): Promise<ConnectedAccount[]> {
    const data = await this.get("connected_accounts");
    if (!Array.isArray(data.connected_accounts)) throw new Error("MF の口座一覧を確認できませんでした");
    const ids = new Set<string>();
    for (const a of data.connected_accounts as ConnectedAccount[]) {
      if (a.id == null || typeof a.name !== "string" || ids.has(String(a.id)) || (a.connected_sub_accounts !== undefined && (!Array.isArray(a.connected_sub_accounts) || !a.connected_sub_accounts.every(s => typeof s.name === "string")))) throw new Error("MF の口座一覧を確認できませんでした");
      ids.add(String(a.id));
    }
    return data.connected_accounts as ConnectedAccount[];
  }
  async trialBalance(): Promise<{ start_date: string; rows: TrialRow[] }> {
    const data = await this.get("reports/trial_balance_bs", { with_sub_accounts: "true" });
    if (typeof data.start_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.start_date) || !Array.isArray(data.rows)) throw new Error("MF の帳簿を確認できませんでした");
    return data as { start_date: string; rows: TrialRow[] };
  }
  async transactions(start: string, end: string): Promise<Transaction[]> {
    const result: Transaction[] = [];
    for (let page = 1; ; page++) {
      const data = await this.get("transactions", { start_date: start, end_date: end, per_page: "500", page: String(page) });
      const pages = (data.metadata as { total_pages?: number } | undefined)?.total_pages;
      if (!Array.isArray(data.transactions) || !Number.isInteger(pages) || pages! < 0 || pages! > 10000) throw new Error("MF の取引を確認できませんでした");
      for (const t of data.transactions as Transaction[]) {
        if (t.id == null || t.connected_account_id == null || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !Number.isFinite(t.value) || !["INCOME", "EXPENSE"].includes(t.side)) throw new Error("MF の取引を確認できませんでした");
        result.push(t);
      }
      if (page >= pages!) return result;
    }
  }
}
