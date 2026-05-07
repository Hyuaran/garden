"use client";

/**
 * 仕訳帳機能 — Q4 全法人 × 口座 残高オーバービュー (後道さん向け前日残高画面)
 *
 * 認証: Forest 親レイアウトの ForestStateProvider 経由 (admin / executive 限定)
 * データ取得: GET /api/forest/shiwakechou/balance-overview
 *
 * 表示:
 *   - 法人 (行) × 銀行 (列) のマトリクス
 *   - 各セル: 最新残高 + ソース (CSV / 手入力 / 未取得)
 *   - 法人別合計 / 銀行別合計 / 全体合計
 *
 * 配置原則: 暫定 Forest, 5/17 以降に Bud に移行。
 *   _components / _lib / _state への直接 import は避ける (親 layout から Provider を継承するのみ)。
 */

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

interface CorpRow {
  id: string;
  code: string;
  name_full: string;
  name_short: string;
  sort_order: number;
}

interface AccountWithBalance {
  id: string;
  corp_id: string;
  bank_kind: string;
  bank_name: string;
  account_number: string;
  sub_account_label: string;
  manual_balance_20260430: number | null;
  has_csv: boolean;
  notes: string | null;
  latest_balance: number | null;
  latest_balance_source: "transactions" | "manual" | "none";
  latest_balance_date: string | null;
}

interface BalanceOverviewData {
  generated_at: string;
  corps: CorpRow[];
  accounts: AccountWithBalance[];
  totals: {
    total_balance: number;
    csv_count: number;
    manual_count: number;
    missing_count: number;
  };
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const BANK_ORDER: ReadonlyArray<{ kind: string; label: string }> = [
  { kind: "mizuho", label: "みずほ" },
  { kind: "paypay", label: "PayPay" },
  { kind: "rakuten", label: "楽天" },
  { kind: "kyoto", label: "京都" },
];

function formatYen(n: number | null): string {
  if (n === null) return "—";
  return `¥${n.toLocaleString("ja-JP")}`;
}

function sourceBadge(source: AccountWithBalance["latest_balance_source"]): {
  label: string;
  color: string;
} {
  switch (source) {
    case "transactions":
      return { label: "CSV 取込済", color: "#10b981" }; // green
    case "manual":
      return { label: "手入力", color: "#f59e0b" }; // amber
    case "none":
      return { label: "未取得", color: "#6b7280" }; // gray
  }
}

export default function BalanceOverviewPage() {
  const [data, setData] = useState<BalanceOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    async function load() {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true },
        });
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (!canceled) {
            setError("ログインが必要です");
            setLoading(false);
          }
          return;
        }

        const res = await fetch("/api/forest/shiwakechou/balance-overview", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          if (!canceled) {
            setError(json.error ?? `HTTP ${res.status}`);
            setLoading(false);
          }
          return;
        }
        if (!canceled) {
          setData(json.data as BalanceOverviewData);
          setLoading(false);
        }
      } catch (e) {
        if (!canceled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        読み込み中...
      </div>
    );
  }
  if (error) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "#dc2626",
          fontWeight: 500,
        }}
      >
        エラー: {error}
      </div>
    );
  }
  if (!data) return null;

  // 法人ごとに口座をグルーピング
  const accountsByCorp = new Map<string, AccountWithBalance[]>();
  for (const a of data.accounts) {
    const list = accountsByCorp.get(a.corp_id) ?? [];
    list.push(a);
    accountsByCorp.set(a.corp_id, list);
  }

  // 法人別合計 (CSV/手入力/未取得 別)
  const corpTotals = new Map<string, number>();
  for (const a of data.accounts) {
    if (a.latest_balance !== null) {
      corpTotals.set(
        a.corp_id,
        (corpTotals.get(a.corp_id) ?? 0) + a.latest_balance,
      );
    }
  }

  // 銀行別合計
  const bankTotals = new Map<string, number>();
  for (const a of data.accounts) {
    if (a.latest_balance !== null) {
      bankTotals.set(
        a.bank_kind,
        (bankTotals.get(a.bank_kind) ?? 0) + a.latest_balance,
      );
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#1f2937",
            margin: 0,
          }}
        >
          残高オーバービュー (Q4)
        </h1>
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            marginTop: 4,
          }}
        >
          全法人 × 銀行口座 最新残高マトリクス /{" "}
          生成: {new Date(data.generated_at).toLocaleString("ja-JP")}
        </div>
      </div>

      {/* 全体サマリ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <SummaryCard
          label="全 12 口座 合計"
          value={formatYen(data.totals.total_balance)}
          color="#1f2937"
        />
        <SummaryCard
          label="CSV 取込済"
          value={`${data.totals.csv_count} 口座`}
          color="#10b981"
        />
        <SummaryCard
          label="手入力残高"
          value={`${data.totals.manual_count} 口座`}
          color="#f59e0b"
        />
        <SummaryCard
          label="未取得"
          value={`${data.totals.missing_count} 口座`}
          color="#6b7280"
        />
      </div>

      {/* マトリクス表 */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              <th style={th()}>法人</th>
              {BANK_ORDER.map((b) => (
                <th key={b.kind} style={th()}>
                  {b.label}
                </th>
              ))}
              <th style={{ ...th(), background: "#eff6ff" }}>法人合計</th>
            </tr>
          </thead>
          <tbody>
            {data.corps.map((corp) => {
              const corpAccounts = accountsByCorp.get(corp.id) ?? [];
              return (
                <tr key={corp.id}>
                  <td style={td(true)}>
                    <div style={{ fontWeight: 600 }}>{corp.name_short}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                      {corp.name_full}
                    </div>
                  </td>
                  {BANK_ORDER.map((b) => {
                    const acct = corpAccounts.find(
                      (a) => a.bank_kind === b.kind,
                    );
                    if (!acct) {
                      return (
                        <td
                          key={b.kind}
                          style={{ ...td(), color: "#d1d5db", textAlign: "center" }}
                        >
                          —
                        </td>
                      );
                    }
                    const badge = sourceBadge(acct.latest_balance_source);
                    return (
                      <td key={b.kind} style={td()}>
                        <div
                          style={{
                            fontWeight: 600,
                            color:
                              acct.latest_balance === null
                                ? "#9ca3af"
                                : "#1f2937",
                            textAlign: "right",
                          }}
                        >
                          {formatYen(acct.latest_balance)}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: badge.color,
                            textAlign: "right",
                            marginTop: 2,
                          }}
                        >
                          {badge.label}
                          {acct.latest_balance_date
                            ? ` (${acct.latest_balance_date})`
                            : ""}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#9ca3af",
                            textAlign: "right",
                            marginTop: 1,
                          }}
                        >
                          口座 {acct.account_number}
                          {!acct.has_csv ? " ⚠️ CSV 無" : ""}
                        </div>
                      </td>
                    );
                  })}
                  <td
                    style={{
                      ...td(),
                      background: "#eff6ff",
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  >
                    {formatYen(corpTotals.get(corp.id) ?? null)}
                  </td>
                </tr>
              );
            })}

            {/* 銀行別合計行 */}
            <tr style={{ background: "#fef3c7" }}>
              <td style={{ ...td(true), fontWeight: 600 }}>銀行合計</td>
              {BANK_ORDER.map((b) => (
                <td
                  key={b.kind}
                  style={{ ...td(), fontWeight: 600, textAlign: "right" }}
                >
                  {formatYen(bankTotals.get(b.kind) ?? null)}
                </td>
              ))}
              <td
                style={{
                  ...td(),
                  background: "#fee2e2",
                  fontWeight: 700,
                  textAlign: "right",
                }}
              >
                {formatYen(data.totals.total_balance)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 注意事項 */}
      <div
        style={{
          marginTop: 16,
          fontSize: 11,
          color: "#6b7280",
          lineHeight: 1.6,
        }}
      >
        <div>
          🟢 CSV 取込済: 銀行明細 CSV から最新残高を取得 /{" "}
          🟡 手入力: 4/30 通帳・残高画面確認 / ⚪ 未取得: データなし
        </div>
        <div>
          ※ PayPay ヒュアラン (¥158,041) はシステム障害により CSV 出力不可、残高のみ手入力。
          みずほリンクサポート CSV は 3 週間分のみ (システム制限)。
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// 内部コンポーネント
// ----------------------------------------------------------------

function SummaryCard(props: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
        {props.label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: props.color,
        }}
      >
        {props.value}
      </div>
    </div>
  );
}

function th(): React.CSSProperties {
  return {
    padding: "10px 12px",
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
  };
}

function td(isFirst = false): React.CSSProperties {
  return {
    padding: "12px",
    borderBottom: "1px solid #f3f4f6",
    verticalAlign: "top",
    background: isFirst ? "#fafafa" : "transparent",
  };
}
