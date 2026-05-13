"use client";

/**
 * Bloom Daily Report MVP (2026-05-07)
 *
 * dispatch main- No. 91 N 案 GO + 自走判断 #7 (a-main-013, 2026-05-07 19:00)
 *
 * 旧版: page.legacy-placeholder-20260507.tsx (準備中表示、削除禁止)
 *
 * MVP スコープ:
 *   - 当日 (or 任意日) の root_daily_reports + root_daily_report_logs を表示
 *   - workstyle (office/home/irregular) + is_irregular + irregular_label 編集
 *   - log entries 動的追加 (category × module × content × ord)
 *   - POST /api/bloom/daily-report で upsert
 *   - dev では DEV_MOCK_USER 経由で東海林さん super_admin 相当
 *
 * post-MVP (5/13 以降):
 *   - メール配信 (毎日定時、上長宛)
 *   - Chatwork 通知
 *   - 一般従業員向け日報 (root_employees_daily_reports 等の新規スキーマ)
 *   - 過去日報の一覧 + フィルタ
 *
 * Schema: src/app/api/bloom/daily-report/route.ts §コメント参照
 *   - root_daily_reports: date / workstyle / is_irregular / irregular_label
 *   - root_daily_report_logs: report_date / category / module / content / ord
 */

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import Link from "next/link";

import { useBloomState } from "../_state/BloomStateContext";

type Workstyle = "office" | "home" | "irregular";
type LogCategory = "work" | "tomorrow" | "special";

type LogRow = {
  report_date: string;
  category: LogCategory;
  module: string;
  content: string;
  ord: number | null;
};

type ReportRow = {
  date: string;
  workstyle: Workstyle;
  is_irregular: boolean;
  irregular_label: string | null;
};

type ApiResponse = {
  date: string;
  report: ReportRow | null;
  logs: LogRow[];
  source: "supabase" | "mock";
};

type EditableLog = {
  category: LogCategory;
  module: string;
  content: string;
};

const MODULES = [
  "bloom",
  "bud",
  "calendar",
  "forest",
  "fruit",
  "leaf",
  "rill",
  "root",
  "seed",
  "soil",
  "sprout",
  "tree",
];

const WORKSTYLE_LABEL: Record<Workstyle, string> = {
  office: "出社",
  home: "在宅",
  irregular: "イレギュラー",
};

const CATEGORY_LABEL: Record<LogCategory, string> = {
  work: "本日の作業",
  tomorrow: "明日の予定",
  special: "特記事項",
};

const CATEGORY_COLOR: Record<LogCategory, string> = {
  work: "#1f5c3a",
  tomorrow: "#8a6c1d",
  special: "#7a5a8a",
};

function todayJst(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e3dccd",
  borderRadius: 12,
  padding: "20px 22px",
  boxShadow: "0 4px 16px rgba(120,100,70,0.06)",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#5c6e5f",
  letterSpacing: "0.06em",
  marginBottom: 10,
  paddingBottom: 6,
  borderBottom: "1px dashed #d3cfb8",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: 14,
  border: "1px solid #dee5de",
  borderRadius: 6,
  outline: "none",
  background: "#fafcfa",
  fontFamily: "inherit",
};

const buttonStyle: CSSProperties = {
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  background: "linear-gradient(135deg, #3b9b5c 0%, #1f5c3a 100%)",
  color: "#fff",
  boxShadow: "0 2px 6px rgba(31,92,58,0.25)",
};

const ghostButtonStyle: CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 500,
  border: "1px solid #d3cfb8",
  borderRadius: 6,
  cursor: "pointer",
  background: "transparent",
  color: "#5c6e5f",
};

export default function DailyReportPage() {
  const { bloomUser } = useBloomState();
  const userName = bloomUser?.name ?? "（未ログイン）";

  const [date, setDate] = useState<string>(todayJst());
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [editWorkstyle, setEditWorkstyle] = useState<Workstyle>("office");
  const [editIsIrregular, setEditIsIrregular] = useState<boolean>(false);
  const [editIrregularLabel, setEditIrregularLabel] = useState<string>("");
  const [editLogs, setEditLogs] = useState<EditableLog[]>([
    { category: "work", module: "bloom", content: "" },
  ]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const fetchData = useCallback(async (targetDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bloom/daily-report?date=${targetDate}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
      if (json.report) {
        setEditWorkstyle(json.report.workstyle);
        setEditIsIrregular(json.report.is_irregular);
        setEditIrregularLabel(json.report.irregular_label ?? "");
      }
      if (json.logs.length > 0) {
        setEditLogs(
          json.logs.map((l) => ({
            category: l.category,
            module: l.module,
            content: l.content,
          })),
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(date);
  }, [date, fetchData]);

  const handleAddLog = () => {
    setEditLogs((prev) => [...prev, { category: "work", module: "bloom", content: "" }]);
  };

  const handleRemoveLog = (idx: number) => {
    setEditLogs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLogChange = (idx: number, patch: Partial<EditableLog>) => {
    setEditLogs((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const validLogs = editLogs.filter((l) => l.content.trim().length > 0);
      const res = await fetch("/api/bloom/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          workstyle: editWorkstyle,
          is_irregular: editIsIrregular,
          irregular_label: editIrregularLabel.trim() || null,
          logs: validLogs.map((l, i) => ({ ...l, ord: i + 1 })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setSubmitMsg(`✅ 提出完了 (${json.source}): ${json.logs_count} 件のログ`);
      await fetchData(date);
    } catch (err) {
      setSubmitMsg(`⚠️ ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, maxWidth: 920, margin: "0 auto" }}>
      <header>
        <h1 style={{ fontSize: 22, margin: 0, color: "#1f5c3a" }}>📋 日報</h1>
        <p style={{ color: "#6b8e75", marginTop: 4, fontSize: 13 }}>
          ようこそ、{userName} さん。
        </p>
      </header>

      {/* 日付セレクタ */}
      <section style={cardStyle}>
        <div style={sectionTitleStyle}>対象日</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="daily-report-date"
            style={{ ...inputStyle, maxWidth: 200 }}
          />
          <button
            type="button"
            onClick={() => setDate(todayJst())}
            style={ghostButtonStyle}
          >
            当日に戻る
          </button>
          {data && (
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 999,
                background: data.source === "supabase" ? "rgba(31,92,58,0.12)" : "rgba(212,165,65,0.18)",
                color: data.source === "supabase" ? "#1f5c3a" : "#8a6c1d",
                letterSpacing: "0.06em",
              }}
            >
              {data.source}
            </span>
          )}
        </div>
      </section>

      {/* 提出済表示 */}
      <section style={cardStyle}>
        <div style={sectionTitleStyle}>{date} の提出済日報</div>
        {loading && <p style={{ color: "#9aa89d", fontSize: 13 }}>読み込み中…</p>}
        {error && <p style={{ color: "#c1121f", fontSize: 13 }}>⚠️ {error}</p>}
        {!loading && !error && data && (
          <>
            {data.report ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 13 }}>
                  <strong style={{ color: "#5c6e5f" }}>勤務形態:</strong>{" "}
                  {WORKSTYLE_LABEL[data.report.workstyle]}
                  {data.report.is_irregular && data.report.irregular_label && (
                    <span style={{ color: "#8a6c1d", marginLeft: 8 }}>
                      （{data.report.irregular_label}）
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: "#9aa89d", fontSize: 13, fontStyle: "italic" }}>
                この日の日報は未提出です。下のフォームから提出してください。
              </p>
            )}
            {data.logs.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {data.logs.map((log, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "6px 10px",
                      borderLeft: `3px solid ${CATEGORY_COLOR[log.category]}`,
                      background: "#f8f6f0",
                      borderRadius: 4,
                    }}
                  >
                    <span style={{ fontSize: 11, color: CATEGORY_COLOR[log.category], fontWeight: 600, minWidth: 80 }}>
                      {CATEGORY_LABEL[log.category]}
                    </span>
                    <span style={{ fontSize: 11, color: "#92857a", minWidth: 60 }}>{log.module}</span>
                    <span style={{ fontSize: 13, color: "#3a2a1a", flex: 1 }}>{log.content}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* 入力フォーム */}
      <section style={cardStyle}>
        <div style={sectionTitleStyle}>提出 / 編集</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "#5c6e5f", fontWeight: 600 }}>勤務形態</label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {(["office", "home", "irregular"] as const).map((ws) => (
                <label
                  key={ws}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    border: editWorkstyle === ws ? "2px solid #1f5c3a" : "1px solid #d3cfb8",
                    borderRadius: 6,
                    cursor: "pointer",
                    textAlign: "center",
                    fontSize: 13,
                    background: editWorkstyle === ws ? "rgba(31,92,58,0.06)" : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="workstyle"
                    value={ws}
                    checked={editWorkstyle === ws}
                    onChange={() => setEditWorkstyle(ws)}
                    style={{ marginRight: 6 }}
                  />
                  {WORKSTYLE_LABEL[ws]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5c6e5f" }}>
              <input
                type="checkbox"
                checked={editIsIrregular}
                onChange={(e) => setEditIsIrregular(e.target.checked)}
              />
              イレギュラー対応あり
            </label>
            {editIsIrregular && (
              <input
                type="text"
                value={editIrregularLabel}
                onChange={(e) => setEditIrregularLabel(e.target.value)}
                placeholder="例: 横断する共通仕様の整理、作業ルール整備"
                style={{ ...inputStyle, marginTop: 6 }}
              />
            )}
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 12, color: "#5c6e5f", fontWeight: 600 }}>ログエントリ</label>
              <button type="button" onClick={handleAddLog} style={ghostButtonStyle}>
                + 追加
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {editLogs.map((log, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 110px 1fr auto",
                    gap: 6,
                    alignItems: "start",
                  }}
                >
                  <select
                    value={log.category}
                    onChange={(e) => handleLogChange(i, { category: e.target.value as LogCategory })}
                    style={{ ...inputStyle, padding: "6px 10px", fontSize: 12 }}
                  >
                    {(["work", "tomorrow", "special"] as const).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={log.module}
                    onChange={(e) => handleLogChange(i, { module: e.target.value })}
                    style={{ ...inputStyle, padding: "6px 10px", fontSize: 12 }}
                  >
                    {MODULES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={log.content}
                    onChange={(e) => handleLogChange(i, { content: e.target.value })}
                    placeholder="作業内容を入力"
                    style={{ ...inputStyle, fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveLog(i)}
                    style={{ ...ghostButtonStyle, fontSize: 11, padding: "6px 8px" }}
                    aria-label={`${i + 1} 行目を削除`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              data-testid="daily-report-submit"
              style={{
                ...buttonStyle,
                opacity: submitting ? 0.6 : 1,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "提出中…" : "提出 / 上書き保存"}
            </button>
            {submitMsg && (
              <span
                style={{
                  fontSize: 13,
                  color: submitMsg.startsWith("✅") ? "#1f5c3a" : "#c1121f",
                }}
              >
                {submitMsg}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 関連ページ */}
      <section
        style={{
          padding: 12,
          borderRadius: 8,
          background: "rgba(248,246,240,0.6)",
          border: "1px dashed #d3cfb8",
          fontSize: 12,
        }}
      >
        <strong style={{ color: "#5c6e5f" }}>関連:</strong>{" "}
        <Link href="/bloom/workboard" style={{ color: "#3b9b5c" }}>ワークボード</Link>{" / "}
        <Link href="/bloom/monthly-digest" style={{ color: "#3b9b5c" }}>月次まとめ</Link>{" / "}
        <Link href="/bloom/ceo-status" style={{ color: "#3b9b5c" }}>経営状況</Link>
        <span style={{ color: "#92857a", marginLeft: 12, fontStyle: "italic" }}>
          MVP: メール / Chatwork 通知 / 上長閲覧は post-デモ (5/13 以降)
        </span>
      </section>
    </main>
  );
}
