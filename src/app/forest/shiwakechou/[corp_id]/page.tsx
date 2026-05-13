"use client";

/**
 * 仕訳帳機能 法人ダッシュボード — 銀行明細アップロード + 各口座一覧
 *
 * spec: docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md §画面 2
 *
 * 機能:
 *   - 法人情報表示
 *   - 銀行口座一覧 (12 口座のうち当該法人分)
 *   - 各口座への銀行 CSV / .api アップロード zone
 *   - アップロード結果プレビュー (parse 結果 10 行)
 *
 * B-min 最小実装: Supabase Storage 永続化 / DB INSERT は 5/13 以降本番接続時
 */

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type { UploadBkResponse } from "@/app/api/forest/shiwakechou/upload-bk/route";

interface CorpRow {
  id: string;
  code: string;
  name_full: string;
  name_short: string;
}

interface AccountRow {
  id: string;
  bank_code: string;
  bank_name: string;
  branch_name: string | null;
  account_number: string;
  sub_account_label: string | null;
  manual_balance_20260430: number | null;
  has_csv_export: boolean;
  notes: string | null;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const BANK_LABEL: Record<string, string> = {
  mizuho: "みずほ銀行",
  paypay: "PayPay 銀行",
  rakuten: "楽天銀行",
  kyoto: "京都銀行",
};

const BANK_COLOR: Record<string, string> = {
  mizuho: "#5b6fc4",
  paypay: "#dc2626",
  rakuten: "#bf0000",
  kyoto: "#0e7c54",
};

function formatYen(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `¥${n.toLocaleString("ja-JP")}`;
}

export default function CorporationDashboardPage() {
  const params = useParams<{ corp_id: string }>();
  const corpId = params.corp_id;

  const [corp, setCorp] = useState<CorpRow | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    async function load() {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true },
        });

        const [{ data: corpData, error: corpErr }, { data: acctData, error: acctErr }] =
          await Promise.all([
            supabase
              .from("bud_corporations")
              .select("id, code, name_full, name_short")
              .eq("id", corpId)
              .maybeSingle(),
            supabase
              .from("root_bank_accounts")
              .select(
                "id, bank_code, bank_name, branch_name, account_number, sub_account_label, manual_balance_20260430, has_csv_export, notes",
              )
              .eq("corp_code", corpId)
              .eq("is_active", true)
              .is("deleted_at", null)
              .order("bank_code", { ascending: true }),
          ]);

        if (canceled) return;
        if (corpErr || !corpData) {
          setError(`法人取得失敗: ${corpErr?.message ?? "not found"}`);
          setLoading(false);
          return;
        }
        if (acctErr) {
          setError(`口座取得失敗: ${acctErr.message}`);
          setLoading(false);
          return;
        }
        setCorp(corpData as CorpRow);
        setAccounts((acctData ?? []) as AccountRow[]);
        setLoading(false);
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
  }, [corpId]);

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
        style={{ padding: 40, textAlign: "center", color: "#dc2626", fontWeight: 500 }}
      >
        エラー: {error}
      </div>
    );
  }
  if (!corp) return null;

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
      {/* breadcrumb */}
      <div
        style={{
          fontSize: 11,
          color: "#9ca3af",
          marginBottom: 8,
        }}
      >
        <Link href="/forest/shiwakechou" style={{ color: "#9ca3af" }}>
          仕訳帳
        </Link>
        {" / "}
        {corp.name_short}
      </div>

      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: "#1f2937",
          margin: "0 0 4px 0",
        }}
      >
        {corp.name_full}
      </h1>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
        {accounts.length} 口座 / 銀行明細アップロード + 仕訳確認
      </div>

      <div style={{ marginBottom: 16 }}>
        <Link
          href={`/forest/shiwakechou/${corpId}/review`}
          style={{
            display: "inline-block",
            padding: "8px 16px",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            color: "#1f2937",
            fontSize: 13,
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          📋 取引確認画面へ
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {accounts.map((acct) => (
          <BankAccountUploadCard key={acct.id} account={acct} />
        ))}
      </div>

      <div
        style={{
          marginTop: 24,
          fontSize: 11,
          color: "#9ca3af",
          lineHeight: 1.6,
        }}
      >
        B-min 最小実装: アップロード後の parse 結果プレビューのみ。Supabase Storage 永続化 / bud_transactions INSERT は 5/13 本番運用接続時に有効化。
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// 口座カード (アップロード zone 含む)
// ----------------------------------------------------------------

function BankAccountUploadCard(props: { account: AccountRow }) {
  const acct = props.account;
  const bankLabel = BANK_LABEL[acct.bank_code] ?? acct.bank_name;
  const bankColor = BANK_COLOR[acct.bank_code] ?? "#6b7280";

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadBkResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accept =
    acct.bank_code === "mizuho"
      ? ".api,.csv,.tsv"
      : ".csv";

  async function handleFile(file: File) {
    setUploading(true);
    setResult(null);
    setErrorMsg(null);
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setErrorMsg("ログインが必要です");
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("bank_account_id", acct.id);
      formData.append("file", file);

      const res = await fetch("/api/forest/shiwakechou/upload-bk", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const json = (await res.json()) as UploadBkResponse;
      if (!res.ok || !json.success) {
        setErrorMsg(json.error ?? `HTTP ${res.status}`);
        setUploading(false);
        return;
      }
      setResult(json);
      setUploading(false);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderLeft: `4px solid ${bankColor}`,
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#1f2937",
            }}
          >
            {bankLabel}
            {acct.branch_name ? ` ${acct.branch_name}` : ""}
            {" "}
            (普通預金) {acct.account_number}
          </div>
          {acct.notes && (
            <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>
              ⚠️ {acct.notes}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#9ca3af" }}>4/30 手入力残高</div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#1f2937",
            }}
          >
            {formatYen(acct.manual_balance_20260430)}
          </div>
        </div>
      </div>

      {!acct.has_csv_export ? (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fbbf24",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            color: "#b45309",
          }}
        >
          この口座は CSV 出力対象外 (システム障害)。アップロード不可、残高のみ手入力で B-min 検算。
        </div>
      ) : (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 16px",
              background: uploading ? "#e5e7eb" : bankColor,
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading
              ? "解析中..."
              : `📁 ${bankLabel} ${
                  acct.bank_code === "mizuho" ? ".api / .csv" : "CSV"
                } をアップロード`}
          </button>

          {errorMsg && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                background: "#fee2e2",
                border: "1px solid #fca5a5",
                borderRadius: 4,
                fontSize: 12,
                color: "#991b1b",
              }}
            >
              エラー: {errorMsg}
            </div>
          )}

          {result?.success && (
            <div
              style={{
                marginTop: 8,
                padding: 12,
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: 4,
                fontSize: 12,
                color: "#166534",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                ✅ パース成功: {result.filename}
              </div>
              <div style={{ color: "#374151" }}>
                {result.row_count} 件 / 期初 {formatYen(result.opening_balance)} →
                期末 {formatYen(result.closing_balance)} / warnings{" "}
                {result.warnings_count}
              </div>
              {result.rows_preview && result.rows_preview.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", color: "#166534" }}>
                    先頭 10 行プレビュー
                  </summary>
                  <table
                    style={{
                      width: "100%",
                      marginTop: 8,
                      fontSize: 11,
                      borderCollapse: "collapse",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#fff" }}>
                        <th style={cellTh}>日付</th>
                        <th style={cellTh}>flow</th>
                        <th style={{ ...cellTh, textAlign: "right" }}>金額</th>
                        <th style={cellTh}>摘要</th>
                        <th style={{ ...cellTh, textAlign: "right" }}>残高</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows_preview.map((r, i) => (
                        <tr key={i}>
                          <td style={cellTd}>{r.transaction_date}</td>
                          <td style={cellTd}>
                            {r.flow === "deposit" ? "入" : "出"}
                          </td>
                          <td style={{ ...cellTd, textAlign: "right" }}>
                            {formatYen(r.amount)}
                          </td>
                          <td
                            style={{ ...cellTd, maxWidth: 300, overflow: "hidden" }}
                          >
                            {r.description.slice(0, 40)}
                          </td>
                          <td style={{ ...cellTd, textAlign: "right" }}>
                            {formatYen(r.balance_after)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const cellTh: React.CSSProperties = {
  padding: "4px 8px",
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  color: "#6b7280",
  fontSize: 10,
};

const cellTd: React.CSSProperties = {
  padding: "4px 8px",
  borderBottom: "1px solid #f3f4f6",
  color: "#1f2937",
};
