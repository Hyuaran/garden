"use client";

/**
 * Garden-Tree アポラン画面 (/tree/aporan)
 *
 * プロトタイプの <AporanScreen /> を移植。
 * APPOINTER RANKING — 月間の成績ランキング。
 *
 * 構成:
 *  1. 期間選択（カレンダーグリッド + 過去6ヶ月ボタン）
 *  2. フィルタ（全員 / トスのみ / クローザーのみ）
 *  3. 集計ボタン（MANAGER のみ実行可能）
 *  4. 更新履歴ツールチップ（MANAGER のみ）
 *  5. サマリーカード（効率 / 実績P / 達成率 / 稼働時間）
 *  6. ランキングテーブル（9列・ソート可=MANAGER のみ）
 *
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useState } from "react";

import { GlassPanel } from "../_components/GlassPanel";
import { PointValue } from "../_components/PointValue";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { ROLES } from "../_constants/roles";
import { USER } from "../_constants/user";
import { P } from "../_lib/format";
import { useTreeState } from "../_state/TreeStateContext";

type RankingRow = {
  rank: number;
  dept: string;
  name: string;
  rType: "toss" | "closer";
  status: string;
  pay: string;
  pts: number;
  hours: number;
  eff: number;
  projH: number;
  projP: number;
};

type SortKey = "pts" | "hours" | "eff" | "projH" | "projP";

const TODAY = "2026/04/14";
const CAL_YEAR = 2026;
const CAL_MONTH = 4;
const CAL_DAYS = new Date(CAL_YEAR, CAL_MONTH, 0).getDate();
const CAL_FIRST_DOW = (new Date(CAL_YEAR, CAL_MONTH - 1, 1).getDay() + 6) % 7;
const CAL_TODAY = 14;

const PAST_MONTHS = [
  { label: "2026年3月", value: "2026/03/31" },
  { label: "2026年2月", value: "2026/02/28" },
  { label: "2026年1月", value: "2026/01/31" },
  { label: "2025年12月", value: "2025/12/31" },
  { label: "2025年11月", value: "2025/11/30" },
  { label: "2025年10月", value: "2025/10/31" },
];

const UPDATE_HISTORY = [
  { date: "2026/04/12（土）18:30", name: "東海林 美琴" },
  { date: "2026/04/11（金）18:15", name: "東海林 美琴" },
  { date: "2026/04/10（木）18:22", name: "東海林 美琴" },
  { date: "2026/04/09（水）18:05", name: "小泉 翔" },
  { date: "2026/04/08（火）18:30", name: "東海林 美琴" },
  { date: "2026/04/07（月）18:18", name: "小泉 翔" },
  { date: "2026/04/06（日）17:55", name: "東海林 美琴" },
];

const RANKING_DATA: RankingRow[] = [
  { rank: 1, dept: "社員", name: "小泉 翔", rType: "closer", status: "社員", pay: "社員", pts: 24.5, hours: 86, eff: 0.28, projH: 204, projP: 58.1 },
  { rank: 2, dept: "社員", name: "石原 孝志朗", rType: "closer", status: "社員", pay: "社員", pts: 21.4, hours: 79, eff: 0.27, projH: 204, projP: 55.3 },
  { rank: 3, dept: "関電", name: "萩尾 拓也", rType: "closer", status: "社員", pay: "社員", pts: 20.7, hours: 63, eff: 0.32, projH: 168, projP: 55.2 },
  { rank: 4, dept: "テレマ", name: "南薗 優樹", rType: "toss", status: "ゴールド", pay: "¥1,400", pts: 14.4, hours: 68, eff: 0.21, projH: 196, projP: 41.5 },
  { rank: 5, dept: "関電", name: "桐井 大輔", rType: "closer", status: "社員", pay: "社員", pts: 12.5, hours: 63, eff: 0.19, projH: 168, projP: 33.3 },
  { rank: 6, dept: "社員", name: "辻 舞由子", rType: "toss", status: "社員", pay: "社員", pts: 12.0, hours: 50, eff: 0.24, projH: 204, projP: 49.0 },
  { rank: 7, dept: "社員", name: "宮永 ひかり", rType: "toss", status: "社員", pay: "社員", pts: 11.5, hours: 79, eff: 0.14, projH: 211, projP: 30.7 },
  { rank: 8, dept: "テレマ", name: "信田 優希", rType: "toss", status: "ブラック", pay: "¥2,075", pts: 11.2, hours: 35, eff: 0.32, projH: 93, projP: 29.8 },
  { rank: 9, dept: "テレマ", name: "林 佳音", rType: "toss", status: "プラチナ", pay: "¥1,600", pts: 7.2, hours: 19, eff: 0.37, projH: 118, projP: 44.7 },
  { rank: 10, dept: "テレマ", name: "田中 実花", rType: "toss", status: "プラチナ", pay: "¥1,750", pts: 5.7, hours: 57, eff: 0.10, projH: 161, projP: 16.1 },
  { rank: 11, dept: "社員", name: "三好 理央", rType: "closer", status: "社員", pay: "社員", pts: 0.8, hours: 20, eff: 0.04, projH: 95, projP: 3.8 },
  { rank: 12, dept: "テレマ", name: "劉 恵美", rType: "toss", status: "シルバー", pay: "¥1,300", pts: 0.6, hours: 43, eff: 0.01, projH: 79, projP: 1.1 },
];

const DOW_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
const FILTER_OPTIONS = [
  { key: "all", label: "全員表示", c: C.midGreen },
  { key: "toss", label: "トスのみ", c: "#3478c6" },
  { key: "closer", label: "クローザーのみ", c: C.gold },
] as const;

function statusColor(s: string): string {
  if (s === "ブラック") return "#333";
  if (s === "プラチナ") return "#6a7b8a";
  if (s === "ゴールド") return C.gold;
  if (s === "シルバー") return "#999";
  return C.midGreen;
}

function medalIcon(r: number): string {
  if (r === 1) return "🥇";
  if (r === 2) return "🥈";
  if (r === 3) return "🥉";
  if (r <= 5) return "🏅";
  return `${r}`;
}

export default function AporanPage() {
  const { role, treeUser } = useTreeState();
  const selfFullName = treeUser?.name ?? USER.fullName;

  const [showHistory, setShowHistory] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [aporanFilter, setAporanFilter] = useState<"all" | "toss" | "closer">("all");

  const isToday = selectedDate === TODAY;
  const summary = {
    efficiency: 0.14,
    resultP: isToday ? 109.9 : 98.5,
    targetP: 300.0,
    workH: isToday ? 784.0 : 720.0,
    projH: 2225.5,
    projP: isToday ? 296.7 : 280.2,
    achieveRate: isToday ? 98.9 : 93.4,
  };

  const handleSort = (key: SortKey) => {
    if (role !== ROLES.MANAGER) return;
    if (sortKey === key) {
      if (sortOrder === "desc") setSortOrder("asc");
      else { setSortKey(null); setSortOrder("desc"); }
    } else { setSortKey(key); setSortOrder("desc"); }
  };

  const filteredData =
    aporanFilter === "toss" ? RANKING_DATA.filter((r) => r.rType === "toss")
    : aporanFilter === "closer" ? RANKING_DATA.filter((r) => r.rType === "closer")
    : RANKING_DATA;

  const ranking = sortKey
    ? [...filteredData]
        .sort((a, b) => sortOrder === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey])
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : filteredData;

  const sortIcon = (key: SortKey) => sortKey === key ? (sortOrder === "desc" ? " ▼" : " ▲") : "";

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color={C.goldDark}>画面3: アポラン（APPOINTER RANKING）</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* 期間選択 + フィルター */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        {/* カレンダードロップダウン */}
        <div style={{ position: "relative" }}
          onMouseEnter={() => setShowCalendar(true)}
          onMouseLeave={() => setShowCalendar(false)}>
          <button style={{
            padding: "10px 18px", borderRadius: 12, border: `2px solid ${C.midGreen}`,
            background: C.white, color: C.darkGreen, fontSize: 13, fontWeight: 700, cursor: "pointer",
            fontFamily: "'Noto Sans JP', sans-serif", display: "flex", alignItems: "center", gap: 8,
          }}>📅 {selectedDate}{isToday && " （本日）"}</button>

          {showCalendar && (
            <div style={{ position: "absolute", top: "100%", left: 0, paddingTop: 8, zIndex: 9999 }}>
              <div style={{
                background: C.white, borderRadius: 16, padding: 20, width: 320,
                boxShadow: "0 12px 40px rgba(0,0,0,0.15)", border: "1px solid rgba(0,0,0,0.06)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.darkGreen, marginBottom: 12, textAlign: "center" }}>{CAL_YEAR}年{CAL_MONTH}月</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                  {DOW_LABELS.map((d) => (
                    <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: d === "土" ? "#3478c6" : d === "日" ? "#c44a4a" : C.textMuted, padding: "4px 0" }}>{d}</div>
                  ))}
                  {Array.from({ length: CAL_FIRST_DOW }, (_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: CAL_DAYS }, (_, i) => {
                    const day = i + 1;
                    const val = `2026/04/${String(day).padStart(2, "0")}`;
                    const isSelected = selectedDate === val;
                    const isToday2 = day === CAL_TODAY;
                    const isFuture = day > CAL_TODAY;
                    const dow = (CAL_FIRST_DOW + i) % 7;
                    return (
                      <button key={day}
                        onClick={() => { if (!isFuture) { setSelectedDate(val); setShowCalendar(false); } }}
                        disabled={isFuture}
                        style={{
                          padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: isToday2 ? 800 : 600,
                          cursor: isFuture ? "default" : "pointer",
                          border: isSelected ? `2px solid ${C.midGreen}` : "1px solid transparent",
                          background: isToday2 ? C.midGreen : isSelected ? "rgba(45,106,79,0.08)" : "transparent",
                          color: isFuture ? "#ccc" : isToday2 ? "#fff" : dow === 5 ? "#3478c6" : dow === 6 ? "#c44a4a" : C.textDark,
                          fontFamily: "'Noto Sans JP', sans-serif", textAlign: "center",
                        }}>{day}</button>
                    );
                  })}
                </div>
                <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8 }}>過去月（最終版）</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {PAST_MONTHS.map((m) => (
                      <button key={m.value} onClick={() => { setSelectedDate(m.value); setShowCalendar(false); }} style={{
                        padding: "8px 4px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                        border: selectedDate === m.value ? `2px solid ${C.midGreen}` : "1px solid #e0e0e0",
                        background: selectedDate === m.value ? "rgba(45,106,79,0.06)" : C.white,
                        color: selectedDate === m.value ? C.darkGreen : C.textMuted,
                        fontFamily: "'Noto Sans JP', sans-serif", textAlign: "center",
                      }}>{m.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フィルター */}
        <div style={{ display: "flex", gap: 6 }}>
          {FILTER_OPTIONS.map((f) => (
            <button key={f.key} onClick={() => setAporanFilter(f.key)} style={{
              padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: aporanFilter === f.key ? `2px solid ${f.c}` : "1px solid #ddd",
              background: aporanFilter === f.key ? `${f.c}10` : C.white,
              color: aporanFilter === f.key ? f.c : C.textMuted, fontFamily: "'Noto Sans JP', sans-serif",
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* 集計ボタン */}
      <button
        onClick={() => { if (role === ROLES.MANAGER) alert("最新データを集計しました"); }}
        disabled={role !== ROLES.MANAGER}
        onMouseEnter={(e) => { if (role === ROLES.MANAGER) e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
        style={{
          width: "100%", padding: "14px 24px", marginBottom: 20, border: "none", borderRadius: 14,
          background: role === ROLES.MANAGER ? `linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})` : "#ccc",
          color: role === ROLES.MANAGER ? C.white : "#999",
          fontSize: 16, fontWeight: 700, cursor: role === ROLES.MANAGER ? "pointer" : "not-allowed",
          fontFamily: "'Noto Sans JP', sans-serif",
          boxShadow: role === ROLES.MANAGER ? `0 4px 16px ${C.midGreen}33` : "none",
          transition: "all 0.2s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}
      >
        🔄 最新データを集計する
        {role !== ROLES.MANAGER && <span style={{ fontSize: 11 }}>（責任者のみ実行可能です）</span>}
      </button>

      {/* 更新情報 */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginBottom: 8, fontSize: 11, color: C.textMuted }}>
        <span>最終更新: 2026/04/12（土）18:30</span>
        <span>更新者: {selfFullName}</span>
        {role === ROLES.MANAGER && (
          <span style={{ position: "relative" }}
            onMouseEnter={() => setShowHistory(true)}
            onMouseLeave={() => setShowHistory(false)}>
            <span style={{ textDecoration: "underline", textDecorationColor: C.midGreen, textUnderlineOffset: 2, cursor: "pointer" }}>📋 更新履歴</span>
            {showHistory && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: 8,
                background: C.white, borderRadius: 14, padding: "16px 20px", width: 340,
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)", border: "1px solid rgba(0,0,0,0.06)", zIndex: 9999,
                fontFamily: "'Noto Sans JP', sans-serif",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.darkGreen, marginBottom: 12 }}>更新履歴（過去1週間）</div>
                {UPDATE_HISTORY.map((h, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", padding: "6px 0",
                    borderBottom: i < UPDATE_HISTORY.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                    fontSize: 12, color: C.textDark,
                  }}>
                    <span style={{ color: C.textMuted }}>{h.date}</span>
                    <span style={{ fontWeight: 600 }}>{h.name}</span>
                  </div>
                ))}
              </div>
            )}
          </span>
        )}
      </div>

      {/* サマリーカード */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <GlassPanel style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>効率</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.textDark }}>{summary.efficiency.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>全体平均</div>
        </GlassPanel>
        <GlassPanel style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>実績P</div>
          <PointValue n={summary.resultP} size={24} />
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>目標 {P(summary.targetP)}</div>
        </GlassPanel>
        <GlassPanel style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>達成率</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: summary.achieveRate >= 100 ? C.midGreen : C.gold }}>
            {summary.achieveRate}<span style={{ fontSize: 14, fontWeight: 600 }}>%</span>
          </div>
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>着地予想 {P(summary.projP)}</div>
        </GlassPanel>
        <GlassPanel style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>稼働時間</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.textDark }}>{summary.workH}<span style={{ fontSize: 14, fontWeight: 600 }}>h</span></div>
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>着地予想 {summary.projH}<span style={{ fontSize: 8 }}>h</span></div>
        </GlassPanel>
      </div>

      {/* ランキングテーブル */}
      <GlassPanel style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "50px 70px 1fr 90px 80px 70px 70px 70px 80px",
          padding: "12px 16px", background: `linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`,
          color: C.white, fontSize: 11, fontWeight: 700, gap: 8,
        }}>
          <div>#</div><div>部署</div><div>氏名</div><div>ステータス</div>
          <div onClick={() => handleSort("pts")} style={{ textAlign: "right", cursor: role === ROLES.MANAGER ? "pointer" : "default" }}>獲得P{sortIcon("pts")}</div>
          <div onClick={() => handleSort("hours")} style={{ textAlign: "right", cursor: role === ROLES.MANAGER ? "pointer" : "default" }}>稼働h{sortIcon("hours")}</div>
          <div onClick={() => handleSort("eff")} style={{ textAlign: "right", cursor: role === ROLES.MANAGER ? "pointer" : "default" }}>効率{sortIcon("eff")}</div>
          <div onClick={() => handleSort("projH")} style={{ textAlign: "right", cursor: role === ROLES.MANAGER ? "pointer" : "default" }}>着地h{sortIcon("projH")}</div>
          <div onClick={() => handleSort("projP")} style={{ textAlign: "right", cursor: role === ROLES.MANAGER ? "pointer" : "default" }}>着地P{sortIcon("projP")}</div>
        </div>
        {ranking.map((r, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "50px 70px 1fr 90px 80px 70px 70px 70px 80px",
            padding: "12px 16px", gap: 8, alignItems: "center",
            background: i < 5 ? `rgba(201,168,76,${0.07 - i * 0.01})` : (i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)"),
            borderBottom: "1px solid rgba(0,0,0,0.04)", fontSize: 13, color: C.textDark,
          }}>
            <div style={{ fontSize: r.rank <= 5 ? 20 : 14, fontWeight: 800, color: r.rank <= 5 ? C.gold : C.textMuted, textAlign: "center" }}>{medalIcon(r.rank)}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{r.dept}</div>
            <div style={{ fontWeight: 700 }}>{r.name}</div>
            <div><span style={{ fontSize: 12, color: statusColor(r.status), fontWeight: 600 }}>{r.status}</span></div>
            <div style={{ textAlign: "right", fontWeight: 800, color: r.pts >= 10 ? C.midGreen : C.textDark }}>{P(r.pts)}</div>
            <div style={{ textAlign: "right", color: C.textSub }}>{r.hours}h</div>
            <div style={{ textAlign: "right", fontWeight: 600, color: r.eff >= 0.20 ? C.midGreen : r.eff >= 0.10 ? C.gold : C.textMuted }}>{r.eff.toFixed(2)}</div>
            <div style={{ textAlign: "right", color: C.textSub }}>{r.projH}h</div>
            <div style={{ textAlign: "right", fontWeight: 700, color: r.projP >= 30 ? C.midGreen : C.textSub }}>{P(r.projP)}</div>
          </div>
        ))}
      </GlassPanel>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        {selectedDate} {isToday ? "最新（複数更新がある場合は最終更新分を表示）" : "終わり時点"} • データはGarden Treeから自動取得
      </div>
    </div>
  );
}
