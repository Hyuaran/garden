"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isLeafUnlocked, clearLeafUnlock, signOutLeaf } from "../_lib/auth";
import { startLeafSessionTimer } from "../_lib/session-timer";
import { fetchCases } from "../_lib/queries";
import type { KandenCase, KandenStatus } from "../_lib/types";
import { STATUS_FLOW, STATUS_LABELS } from "../_lib/types";
import { colors } from "../_constants/colors";
import { StatusBadge } from "./_components/StatusBadge";
import { SupplyInline } from "./_components/SupplyInline";
import { StatusFlow } from "./_components/StatusFlow";
import { NewCaseModal } from "./_components/NewCaseModal";
import { StatusAdvanceBar } from "./_components/StatusAdvanceBar";

// ─── ロック画面 ───────────────────────────────────────────────────────────────
function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [empDisplay, setEmpDisplay] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // マウント時にログインユーザーの社員番号を表示用に取得
  useEffect(() => {
    (async () => {
      const { getUser } = await import("../_lib/auth");
      const user = await getUser();
      if (user?.email) {
        const m = user.email.match(/^emp(\d+)@/);
        if (m) setEmpDisplay(m[1]);
      }
    })();
  }, []);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { signInLeaf, getUser } = await import("../_lib/auth");
    const user = await getUser();
    if (!user?.email) {
      setError("セッションが切れています。ログインし直してください。");
      setLoading(false);
      return;
    }
    const m = user.email.match(/^emp(\d+)@/);
    if (!m) {
      setError("アカウント情報の形式が不正です。");
      setLoading(false);
      return;
    }
    const result = await signInLeaf(m[1], pw);
    setLoading(false);
    if (result.success) {
      onUnlock();
    } else {
      setError("パスワードが正しくありません");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,30,20,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Meiryo, sans-serif",
      }}
    >
      <div
        style={{
          background: colors.bgCard,
          borderRadius: 12,
          padding: "40px 48px",
          width: "100%",
          maxWidth: 360,
          boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginBottom: 4 }}>
          画面がロックされています
        </div>
        {empDisplay && (
          <div
            style={{
              fontSize: 13,
              color: colors.text,
              background: colors.bg,
              padding: "6px 10px",
              borderRadius: 6,
              display: "inline-block",
              marginBottom: 12,
            }}
          >
            社員番号: <b>{empDisplay}</b>
          </div>
        )}
        <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 24 }}>
          続けるにはパスワードを入力してください
        </div>

        <form onSubmit={handleUnlock}>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="パスワード"
            autoFocus
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 6,
              border: `1.5px solid ${colors.border}`,
              fontSize: 14,
              color: colors.text,
              background: "#fff",
              marginBottom: 16,
              boxSizing: "border-box",
              outline: "none",
            }}
          />

          {error && (
            <div
              style={{
                background: colors.dangerBg,
                color: colors.danger,
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "11px",
              borderRadius: 6,
              border: "none",
              background: colors.accent,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            {loading ? "確認中..." : "ロック解除"}
          </button>

          <button
            type="button"
            onClick={() => {
              clearLeafUnlock();
              signOutLeaf().then(() => router.replace("/leaf/login"));
            }}
            style={{
              background: "none",
              border: "none",
              color: colors.textMuted,
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            別のアカウントでログイン
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── 案件行 ───────────────────────────────────────────────────────────────────
function CaseRow({ c, onSelect }: { c: KandenCase; onSelect: (c: KandenCase) => void }) {
  return (
    <tr
      onClick={() => onSelect(c)}
      style={{
        cursor: "pointer",
        borderBottom: `1px solid ${colors.borderLight}`,
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = colors.accentLight)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "")}
    >
      <td style={td}>
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.accent }}>{c.case_id}</div>
        {c.is_urgent_sw && (
          <span
            style={{
              fontSize: 10,
              background: colors.urgentBg,
              color: colors.urgent,
              padding: "1px 5px",
              borderRadius: 4,
              fontWeight: 700,
            }}
          >
            至急SW
          </span>
        )}
      </td>
      <td style={td}>
        <StatusBadge status={c.status} compact />
      </td>
      <td style={{ ...td, maxWidth: 140 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {c.customer_name ?? "—"}
        </div>
        <div style={{ fontSize: 11, color: colors.textMuted }}>{c.customer_number}</div>
      </td>
      <td style={{ ...td, maxWidth: 120 }}>
        <div style={{ fontSize: 11, color: colors.textMuted }}>{c.sales_name ?? "—"}</div>
      </td>
      <td style={td}>
        <SupplyInline supplyPoint22={c.supply_point_22} supplyStartDate={c.supply_start_date} />
      </td>
      <td style={td}>
        <div style={{ fontSize: 11, color: colors.textMuted }}>
          {c.submitted_at?.slice(0, 10) ?? "—"}
        </div>
      </td>
      <td style={td}>
        <StatusFlow currentStatus={c.status} compact />
      </td>
    </tr>
  );
}

const td: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "middle",
  fontSize: 12,
};

// ─── メインページ ─────────────────────────────────────────────────────────────
export default function BackofficePage() {
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const [cases, setCases] = useState<KandenCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フィルター状態
  const [filterStatus, setFilterStatus] = useState<KandenStatus | "">("");
  const [search, setSearch] = useState("");

  // 選択中案件（詳細モーダル用）
  const [selected, setSelected] = useState<KandenCase | null>(null);

  // 新規登録モーダル表示
  const [showNewCase, setShowNewCase] = useState(false);

  // ─ 認証チェック ─
  useEffect(() => {
    if (!isLeafUnlocked()) {
      router.replace("/leaf/login");
    }
  }, [router]);

  // ─ 5分タイマー ─
  useEffect(() => {
    const cleanup = startLeafSessionTimer(() => setLocked(true));
    return cleanup;
  }, []);

  // ─ データ取得 ─
  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCases();
      setCases(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // ─ フィルタリング ─
  const filtered = useMemo(() => {
    let list = cases;
    if (filterStatus) list = list.filter((c) => c.status === filterStatus);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.customer_number.toLowerCase().includes(s) ||
          (c.customer_name ?? "").toLowerCase().includes(s) ||
          (c.sales_name ?? "").toLowerCase().includes(s) ||
          c.case_id.toLowerCase().includes(s) ||
          (c.supply_point_22 ?? "").toLowerCase().includes(s),
      );
    }
    return list;
  }, [cases, filterStatus, search]);

  // ─ ステータス集計 ─
  const statusCounts = useMemo(() => {
    const map: Partial<Record<KandenStatus, number>> = {};
    cases.forEach((c) => {
      map[c.status] = (map[c.status] ?? 0) + 1;
    });
    return map;
  }, [cases]);

  // ─ 離席ボタン ─
  function handleManualLock() {
    clearLeafUnlock();
    setLocked(true);
  }

  return (
    <>
      {locked && (
        <LockScreen
          onUnlock={() => setLocked(false)}
        />
      )}

      {showNewCase && (
        <NewCaseModal
          onClose={() => setShowNewCase(false)}
          onCreated={() => {
            loadCases();
          }}
        />
      )}

      <div
        style={{
          minHeight: "100vh",
          background: colors.bg,
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Meiryo, sans-serif",
        }}
      >
        {/* ─ ヘッダー ─ */}
        <header
          style={{
            background: colors.bgSidebar,
            color: colors.textOnDark,
            padding: "0 24px",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🍃</span>
            <div>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Garden Leaf</span>
              <span
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  color: colors.textOnDarkMuted,
                }}
              >
                関電業務委託 — 事務管理
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setShowNewCase(true)}
              style={{
                background: colors.accent,
                border: "1px solid transparent",
                color: "#fff",
                padding: "6px 16px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ＋ 新規案件
            </button>
            <button
              onClick={handleManualLock}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: colors.textOnDark,
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              🔒 離席
            </button>
            <button
              onClick={() =>
                signOutLeaf().then(() => router.replace("/leaf/login"))
              }
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.2)",
                color: colors.textOnDarkMuted,
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ログアウト
            </button>
          </div>
        </header>

        {/* ─ ステータスサマリーバー ─ */}
        <div
          style={{
            background: colors.bgCard,
            borderBottom: `1px solid ${colors.border}`,
            padding: "10px 24px",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => setFilterStatus("")}
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              border: `1.5px solid ${!filterStatus ? colors.accent : colors.border}`,
              background: !filterStatus ? colors.accentLight : "transparent",
              color: !filterStatus ? colors.accent : colors.textMuted,
              fontSize: 12,
              fontWeight: !filterStatus ? 700 : 400,
              cursor: "pointer",
            }}
          >
            すべて ({cases.length})
          </button>
          {STATUS_FLOW.map((s) => {
            const count = statusCounts[s.key] ?? 0;
            if (count === 0 && filterStatus !== s.key) return null;
            return (
              <button
                key={s.key}
                onClick={() =>
                  setFilterStatus(filterStatus === s.key ? "" : s.key)
                }
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: `1.5px solid ${filterStatus === s.key ? colors.accent : colors.border}`,
                  background:
                    filterStatus === s.key ? colors.accentLight : "transparent",
                  color:
                    filterStatus === s.key ? colors.accent : colors.textMuted,
                  fontSize: 12,
                  fontWeight: filterStatus === s.key ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {s.label} ({count})
              </button>
            );
          })}
        </div>

        {/* ─ コンテンツ ─ */}
        <div style={{ padding: "20px 24px" }}>
          {/* 検索バー */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 16,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              type="search"
              placeholder="🔍 お客様番号・氏名・案件ID・供給地点で検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: 240,
                padding: "8px 14px",
                borderRadius: 8,
                border: `1.5px solid ${colors.border}`,
                fontSize: 13,
                color: colors.text,
                background: "#fff",
                outline: "none",
              }}
            />
            <button
              onClick={loadCases}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.bgCard,
                color: colors.text,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              更新
            </button>
            <div style={{ fontSize: 13, color: colors.textMuted }}>
              {filtered.length} 件
            </div>
          </div>

          {/* エラー表示 */}
          {error && (
            <div
              style={{
                background: colors.dangerBg,
                color: colors.danger,
                padding: "12px 16px",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              ⚠️ データ取得エラー: {error}
            </div>
          )}

          {/* 案件テーブル */}
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: 60,
                color: colors.textMuted,
                fontSize: 14,
              }}
            >
              読込中...
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 60,
                color: colors.textMuted,
                fontSize: 14,
                background: colors.bgCard,
                borderRadius: 10,
              }}
            >
              {cases.length === 0
                ? "案件データがありません。Supabase にデータを投入してください。"
                : "検索条件に一致する案件がありません。"}
            </div>
          ) : (
            <div
              style={{
                background: colors.bgCard,
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                overflow: "hidden",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: colors.bg,
                        borderBottom: `2px solid ${colors.border}`,
                      }}
                    >
                      {[
                        "案件ID",
                        "ステータス",
                        "顧客",
                        "営業",
                        "供給開始日",
                        "受付日",
                        "進捗",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontSize: 11,
                            fontWeight: 600,
                            color: colors.textMuted,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <CaseRow key={c.case_id} c={c} onSelect={setSelected} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─ 案件詳細モーダル ─ */}
      {selected && (
        <CaseDetailModal
          c={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            loadCases();
          }}
        />
      )}
    </>
  );
}

// ─── 案件詳細モーダル ─────────────────────────────────────────────────────────
function CaseDetailModal({
  c,
  onClose,
  onUpdated,
}: {
  c: KandenCase;
  onClose: () => void;
  onUpdated: (updated: KandenCase) => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 1000,
        padding: "40px 16px",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.bgCard,
          borderRadius: 12,
          width: "100%",
          maxWidth: 680,
          boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>
              {c.case_id}
            </div>
            <div
              style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}
            >
              {c.customer_name ?? "顧客名未設定"} / {c.customer_number}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {c.is_urgent_sw && (
              <span
                style={{
                  background: colors.urgentBg,
                  color: colors.urgent,
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                🔴 至急SW
              </span>
            )}
            <StatusBadge status={c.status} />
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: 20,
                cursor: "pointer",
                color: colors.textMuted,
                lineHeight: 1,
                padding: "0 4px",
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ステータスフロー */}
        <div
          style={{
            padding: "16px 24px",
            background: colors.bg,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <StatusFlow currentStatus={c.status} />
        </div>

        {/* 詳細情報 */}
        <div style={{ padding: "20px 24px" }}>
          {/* ステータス操作バー（Phase A-2） */}
          <StatusAdvanceBar c={c} onUpdated={onUpdated} />
          {/* 供給開始日 */}
          <Section title="供給開始予定日">
            <SupplyInline
              supplyPoint22={c.supply_point_22}
              supplyStartDate={c.supply_start_date}
            />
          </Section>

          {/* 顧客情報 */}
          <Section title="顧客情報">
            <Grid>
              <Field label="お客様番号" value={c.customer_number} />
              <Field label="顧客名" value={c.customer_name} />
              <Field label="供給地点番号(22桁)" value={c.supply_point_22} mono />
              <Field label="日程コード" value={c.supply_schedule_code} />
            </Grid>
          </Section>

          {/* 営業担当 */}
          <Section title="営業担当">
            <Grid>
              <Field label="社員番号" value={c.sales_employee_number} />
              <Field label="担当者名" value={c.sales_name} />
              <Field label="部署" value={c.sales_department} />
              <Field label="申込コード" value={c.app_code} />
            </Grid>
          </Section>

          {/* 案件属性 */}
          <Section title="案件属性">
            <Grid>
              <Field label="案件種別" value={c.case_type} />
              <Field label="獲得種別" value={c.acquisition_type} />
              <Field label="直営案件" value={c.is_direct_operation ? "はい" : "いいえ"} />
              <Field label="諸元有り" value={c.specs_ready_on_submit ? "あり" : "なし"} />
              <Field label="PD番号" value={c.pd_number} />
              <Field label="旧PD番号" value={c.old_pd_number} />
            </Grid>
          </Section>

          {/* 日付フロー */}
          <Section title="ステータス日付">
            <Grid cols={4}>
              {STATUS_FLOW.map((s) => (
                <Field
                  key={s.key}
                  label={s.dateLabel}
                  value={(c[s.dateField] as string | null)?.slice(0, 10)}
                />
              ))}
            </Grid>
          </Section>

          {/* メモ */}
          {(c.review_note || c.note) && (
            <Section title="メモ">
              {c.review_note && (
                <div
                  style={{
                    fontSize: 13,
                    color: colors.text,
                    background: colors.warningBg,
                    padding: "8px 12px",
                    borderRadius: 6,
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontWeight: 600, color: colors.warning }}>
                    レビューメモ:{" "}
                  </span>
                  {c.review_note}
                </div>
              )}
              {c.note && (
                <div style={{ fontSize: 13, color: colors.text }}>
                  {c.note}
                </div>
              )}
            </Section>
          )}
        </div>

        {/* モーダルフッター */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: "transparent",
              color: colors.textMuted,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 細部コンポーネント ────────────────────────────────────────────────────────
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: `1px solid ${colors.borderLight}`,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Grid({
  children,
  cols = 3,
}: {
  children: React.ReactNode;
  cols?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "8px 16px",
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: colors.textMuted,
          fontWeight: 600,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: value ? colors.text : colors.border,
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-all",
        }}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}
