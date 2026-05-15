"use client";

/**
 * 仕訳帳 確認画面 (B-min #5)
 *
 * spec: docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md §画面 3
 *
 * 機能:
 *   - 法人 + 期間 (default 2026-04-01〜04-30) の取引一覧表示
 *   - status 別色分け (pending=黄 / ok=白 / internal_transfer=水色 / excluded=灰)
 *   - 整合性検証メータ (期初 + 純流入 = 期末 の matched 判定)
 *   - status フィルタ
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type {
  TransactionListData,
  TransactionListRow,
} from "@/app/api/forest/shiwakechou/transactions/route";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const STATUS_COLORS: Record<string, { bg: string; label: string; color: string }> = {
  pending: { bg: "#fef3c7", label: "要確認", color: "#b45309" },
  ok: { bg: "#ffffff", label: "確認済", color: "#166534" },
  internal_transfer: { bg: "#cffafe", label: "口座移し替え", color: "#075985" },
  intercompany: { bg: "#dcfce7", label: "法人間取引", color: "#166534" },
  excluded: { bg: "#f3f4f6", label: "対象外", color: "#6b7280" },
};

function formatYen(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("ja-JP");
}

export default function TransactionReviewPage() {
  const params = useParams<{ corp_id: string }>();
  const corpId = params.corp_id;

  const [data, setData] = useState<TransactionListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

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

        const url = new URL("/api/forest/shiwakechou/transactions", window.location.origin);
        url.searchParams.set("corp_id", corpId);
        if (statusFilter) url.searchParams.set("status", statusFilter);

        const res = await fetch(url.toString(), {
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
          setData(json.data as TransactionListData);
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
  }, [corpId, statusFilter]);

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
  if (!data) return null;

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
      {/* breadcrumb */}
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
        <Link href="/forest/shiwakechou" style={{ color: "#9ca3af" }}>
          仕訳帳
        </Link>
        {" / "}
        <Link
          href={`/forest/shiwakechou/${corpId}`}
          style={{ color: "#9ca3af" }}
        >
          {corpId}
        </Link>
        {" / "}
        確認画面
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "#1f2937",
              margin: "0 0 4px 0",
            }}
          >
            取引確認 ({corpId})
          </h1>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
            期間: {data.period_from} 〜 {data.period_to} / 合計 {data.total_count} 件
          </div>
        </div>
        <ExportYayoiButton corpId={corpId} month="2026-04" />
      </div>

      {/* status 別サマリ + フィルタ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {Object.entries(STATUS_COLORS).map(([status, conf]) => {
          const count = data.status_summary[status] ?? 0;
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(isActive ? "" : status)}
              style={{
                background: isActive ? conf.color : conf.bg,
                color: isActive ? "#fff" : conf.color,
                border: `1px solid ${conf.color}`,
                borderRadius: 6,
                padding: "10px 12px",
                cursor: "pointer",
                fontSize: 12,
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 600 }}>{conf.label}</div>
              <div style={{ fontSize: 18, marginTop: 2 }}>{count}</div>
            </button>
          );
        })}
      </div>

      {statusFilter && (
        <div
          style={{
            marginBottom: 12,
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          フィルタ: <strong>{STATUS_COLORS[statusFilter]?.label}</strong>{" "}
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            style={{
              background: "transparent",
              border: "none",
              color: "#3b82f6",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            (クリア)
          </button>
        </div>
      )}

      {/* 整合性検証 */}
      <ConsistencyCheckSection checks={data.consistency_check} />

      {/* 取引一覧 */}
      <TransactionTable rows={data.rows} />

      {/* footer */}
      <div
        style={{
          marginTop: 16,
          fontSize: 11,
          color: "#9ca3af",
          lineHeight: 1.6,
        }}
      >
        B-min 最小実装。 status='pending' 行は UI 手動で借方/貸方/税区分を補完予定 (β/リリース版で実装)。
        弥生 CSV エクスポートは shared lib bank-csv-parsers/yayoi-csv-exporter で実施 (PR #161)。
      </div>
    </div>
  );
}

function ConsistencyCheckSection(props: {
  checks: TransactionListData["consistency_check"];
}) {
  const { checks } = props;
  if (checks.length === 0) return null;

  const matched = checks.filter((c) => c.matched).length;
  const mismatched = checks.length - matched;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#1f2937",
          marginBottom: 8,
        }}
      >
        整合性検証 (期初 + 純流入 = 期末)
      </div>
      <div style={{ marginBottom: 8, fontSize: 12 }}>
        {matched === checks.length ? (
          <span style={{ color: "#166534" }}>
            ✅ 全 {checks.length} 口座一致
          </span>
        ) : (
          <span style={{ color: "#b45309" }}>
            ⚠️ {mismatched} 口座不一致 / {checks.length} 口座中
          </span>
        )}
      </div>
      <table
        style={{
          width: "100%",
          fontSize: 11,
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <th style={cellTh}>口座</th>
            <th style={{ ...cellTh, textAlign: "right" }}>件数</th>
            <th style={{ ...cellTh, textAlign: "right" }}>期初</th>
            <th style={{ ...cellTh, textAlign: "right" }}>入金 sum</th>
            <th style={{ ...cellTh, textAlign: "right" }}>出金 sum</th>
            <th style={{ ...cellTh, textAlign: "right" }}>逆算期末</th>
            <th style={{ ...cellTh, textAlign: "right" }}>実期末</th>
            <th style={cellTh}>判定</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.bank_account_id}>
              <td style={cellTd}>
                {c.bank_kind} {c.account_number}
              </td>
              <td style={{ ...cellTd, textAlign: "right" }}>
                {c.transaction_count}
              </td>
              <td style={{ ...cellTd, textAlign: "right" }}>
                {formatYen(c.opening_balance)}
              </td>
              <td style={{ ...cellTd, textAlign: "right", color: "#166534" }}>
                +{formatYen(c.deposit_sum)}
              </td>
              <td style={{ ...cellTd, textAlign: "right", color: "#dc2626" }}>
                -{formatYen(c.withdrawal_sum)}
              </td>
              <td style={{ ...cellTd, textAlign: "right" }}>
                {formatYen(c.derived_closing_balance)}
              </td>
              <td style={{ ...cellTd, textAlign: "right" }}>
                {formatYen(c.actual_closing_balance)}
              </td>
              <td style={cellTd}>
                {c.transaction_count === 0
                  ? <span style={{ color: "#6b7280" }}>—</span>
                  : c.matched
                  ? <span style={{ color: "#166534" }}>✅</span>
                  : <span style={{ color: "#dc2626" }}>❌ 差 {formatYen((c.actual_closing_balance ?? 0) - (c.derived_closing_balance ?? 0))}</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionTable(props: { rows: TransactionListRow[] }) {
  const { rows } = props;
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "#9ca3af",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
        }}
      >
        該当する取引がありません。フィルタを変更するか、銀行明細をアップロードしてください。
      </div>
    );
  }
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead style={{ background: "#f9fafb" }}>
          <tr>
            <th style={cellTh}>日付</th>
            <th style={cellTh}>口座</th>
            <th style={{ ...cellTh, textAlign: "right" }}>金額</th>
            <th style={cellTh}>flow</th>
            <th style={cellTh}>摘要</th>
            <th style={cellTh}>借方</th>
            <th style={cellTh}>貸方</th>
            <th style={cellTh}>税区分</th>
            <th style={cellTh}>状態</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const conf = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending;
            return (
              <tr key={r.id} style={{ background: conf.bg }}>
                <td style={cellTd}>{r.transaction_date}</td>
                <td style={cellTd}>
                  {r.bank_kind} {r.account_number}
                </td>
                <td style={{ ...cellTd, textAlign: "right", fontWeight: 500 }}>
                  ¥{formatYen(r.amount)}
                </td>
                <td style={cellTd}>{r.flow === "deposit" ? "入" : "出"}</td>
                <td style={{ ...cellTd, maxWidth: 280 }}>
                  {r.description.slice(0, 60)}
                  {r.description.length > 60 ? "..." : ""}
                </td>
                <td style={cellTd}>{r.debit_account ?? "—"}</td>
                <td style={cellTd}>{r.credit_account ?? "—"}</td>
                <td style={cellTd}>{r.tax_class ?? "—"}</td>
                <td style={{ ...cellTd, color: conf.color, fontWeight: 500 }}>
                  {conf.label}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const cellTh: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  color: "#6b7280",
  fontSize: 11,
  fontWeight: 600,
};

const cellTd: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #f3f4f6",
  color: "#1f2937",
};

// ----------------------------------------------------------------
// 弥生 CSV export ボタン (dispatch # 351 ヒュアラン決算救援)
// ----------------------------------------------------------------

function ExportYayoiButton(props: { corpId: string; month: string }) {
  const { corpId, month } = props;
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("ログインが必要です");
        setExporting(false);
        return;
      }

      const url = new URL(
        "/api/forest/shiwakechou/export",
        window.location.origin,
      );
      url.searchParams.set("corp_id", corpId);
      url.searchParams.set("month", month);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        // エラー時は JSON 応答
        let errMsg = `HTTP ${res.status}`;
        try {
          const json = await res.json();
          errMsg = json.error ?? errMsg;
        } catch {
          // ignore
        }
        setError(errMsg);
        setExporting(false);
        return;
      }

      // 成功時は CSV bytes をダウンロード
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${corpId}_${month}_弥生.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
      setExporting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setExporting(false);
    }
  }

  return (
    <div style={{ textAlign: "right" }}>
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        style={{
          padding: "10px 16px",
          background: exporting ? "#e5e7eb" : "#166534",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          cursor: exporting ? "not-allowed" : "pointer",
        }}
      >
        {exporting ? "生成中..." : `📤 弥生 CSV export (${month})`}
      </button>
      {error && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 4,
            fontSize: 12,
            color: "#991b1b",
            maxWidth: 360,
          }}
        >
          エラー: {error}
        </div>
      )}
    </div>
  );
}
