"use client";

/**
 * Garden-Tree モニタリング画面 (/tree/monitoring)
 *
 * プロトタイプの <MonitoringScreen /> を移植。
 *
 * 構成:
 *  1. フィルタボタン（全員 / トス / クローザー / 座席表）
 *  2. ステータスサマリーバッジ
 *  3. 座席表レイアウト or 一覧グリッド
 *  4. 管理者パスワード変更
 *
 * - MANAGER専用画面
 * - 座席表はゾーン別グリッドレイアウト
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useEffect, useRef, useState } from "react";

import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";

/* ---------- 型定義 ---------- */

type EmployeeStatus = "架電中" | "通話中" | "入力中" | "待機中" | "離席中" | "休憩中";

type Employee = {
  id: string;
  name: string;
  role: "トス" | "クローザー" | "責任者";
  status: EmployeeStatus;
  sec: number;
};

type SeatZone = {
  id: string;
  name: string;
  cols: number;
  headerSeat?: string;
  seats: (string | null)[];
  footerSeat?: string;
};

type FilterKey = "all" | "toss" | "closer" | "seat";

/* ---------- デモデータ ---------- */

const EMPLOYEES: Employee[] = [
  { id: "e1", name: "信田 優希", role: "トス", status: "架電中", sec: 45 },
  { id: "e2", name: "林 佳音", role: "トス", status: "通話中", sec: 180 },
  { id: "e3", name: "南薗 優樹", role: "トス", status: "入力中", sec: 62 },
  { id: "e4", name: "桐井 大輔", role: "トス", status: "架電中", sec: 12 },
  { id: "e5", name: "田中 実花", role: "トス", status: "待機中", sec: 0 },
  { id: "e6", name: "森 健登", role: "トス", status: "離席中", sec: 320 },
  { id: "e7", name: "谷本 結那", role: "トス", status: "休憩中", sec: 600 },
  { id: "e8", name: "劉 恵美", role: "トス", status: "架電中", sec: 28 },
  { id: "e9", name: "萩尾 拓也", role: "クローザー", status: "通話中", sec: 420 },
  { id: "e10", name: "小泉 翔", role: "クローザー", status: "待機中", sec: 0 },
  { id: "e11", name: "石原 孝志朗", role: "クローザー", status: "入力中", sec: 95 },
  { id: "e12", name: "東海林 美琴", role: "責任者", status: "待機中", sec: 0 },
];

const SEAT_LAYOUT: SeatZone[] = [
  { id: "z1", name: "Aゾーン（トス）", cols: 3, headerSeat: "e12", seats: ["e1", "e2", "e3", "e4", "e5", "e6"] },
  { id: "z2", name: "Bゾーン（トス）", cols: 2, seats: ["e7", "e8", null, null] },
  { id: "z3", name: "クローザーブース", cols: 3, seats: ["e9", "e10", "e11"] },
];

const empMap = Object.fromEntries(EMPLOYEES.map((e) => [e.id, e]));

/* ---------- ヘルパー ---------- */

function roleColor(r: string): string {
  if (r === "トス") return "#c44a4a";
  if (r === "クローザー") return C.gold;
  if (r === "責任者") return "#3478c6";
  return "#888";
}

function statusIcon(s: EmployeeStatus): { icon: string; color: string } {
  switch (s) {
    case "架電中": return { icon: "📞", color: "#3478c6" };
    case "通話中": return { icon: "🗣️", color: C.midGreen };
    case "入力中": return { icon: "⌨️", color: "#e67e22" };
    case "待機中": return { icon: "⏸️", color: C.textMuted };
    case "離席中": return { icon: "🚶", color: C.red };
    case "休憩中": return { icon: "☕", color: "#8b5cf6" };
  }
}

function isActive(s: EmployeeStatus): boolean {
  return s === "架電中" || s === "通話中";
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* ---------- サブコンポーネント ---------- */

function SeatCell({ emp }: { emp: Employee | null }) {
  if (!emp) {
    return (
      <div style={{
        height: 88, borderRadius: 10, border: "2px dashed rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, color: C.textMuted,
      }}>
        空席
      </div>
    );
  }
  const si = statusIcon(emp.status);
  return (
    <div style={{
      height: 88, borderRadius: 10, padding: "8px 10px",
      background: isActive(emp.status) ? "rgba(45,106,79,0.06)" : "rgba(0,0,0,0.02)",
      border: `2px solid ${isActive(emp.status) ? C.accentGreen : "rgba(0,0,0,0.04)"}`,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.textDark }}>{emp.name}</span>
        <span style={{ fontSize: 10, color: roleColor(emp.role), fontWeight: 600 }}>{emp.role}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13 }}>{si.icon} <span style={{ fontSize: 11, color: si.color, fontWeight: 600 }}>{emp.status}</span></span>
        {emp.sec > 0 && <span style={{ fontSize: 11, fontFamily: "monospace", color: C.textMuted }}>{fmt(emp.sec)}</span>}
      </div>
    </div>
  );
}

/* ---------- メインコンポーネント ---------- */

export default function MonitoringPage() {
  const [monFilter, setMonFilter] = useState<FilterKey>("seat");
  const [showSeatConfig, setShowSeatConfig] = useState(false);
  const seatConfigRef = useRef<HTMLDivElement>(null);

  // 座席設定の外側クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (seatConfigRef.current && !seatConfigRef.current.contains(e.target as Node)) {
        setShowSeatConfig(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // フィルタリング
  const filtered = (() => {
    if (monFilter === "toss") return EMPLOYEES.filter((e) => e.role === "トス");
    if (monFilter === "closer") return EMPLOYEES.filter((e) => e.role === "クローザー" || e.role === "責任者");
    return EMPLOYEES;
  })();

  // ステータス集計
  const statusCounts: Record<string, number> = {};
  EMPLOYEES.forEach((e) => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });

  const filters: { key: FilterKey; label: string; c: string }[] = [
    { key: "all", label: "全員", c: C.textDark },
    { key: "toss", label: "トス", c: "#c44a4a" },
    { key: "closer", label: "クローザー", c: C.gold },
    { key: "seat", label: "座席表", c: "#3478c6" },
  ];

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#3478c6">📊 モニタリング</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* フィルタ + ステータスサマリー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setMonFilter(f.key)}
              style={{
                padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
                background: monFilter === f.key ? f.c : "rgba(0,0,0,0.04)",
                color: monFilter === f.key ? C.white : C.textSub,
                transition: "all 0.2s",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["架電中", "通話中", "入力中", "待機中", "離席中", "休憩中"] as EmployeeStatus[]).map((s) => {
            const si = statusIcon(s);
            return (
              <span key={s} style={{
                fontSize: 11, padding: "3px 8px", borderRadius: 8,
                background: `${si.color}10`, color: si.color, fontWeight: 600,
              }}>
                {si.icon} {statusCounts[s] || 0}
              </span>
            );
          })}
        </div>
      </div>

      {/* 座席表モード */}
      {monFilter === "seat" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {SEAT_LAYOUT.map((zone) => (
            <GlassPanel key={zone.id} style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 12 }}>{zone.name}</div>
              {/* ヘッダー席 */}
              {zone.headerSeat && (
                <div style={{ marginBottom: 8 }}>
                  <SeatCell emp={empMap[zone.headerSeat] || null} />
                </div>
              )}
              {/* メイン席 */}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${zone.cols}, 1fr)`, gap: 8 }}>
                {zone.seats.map((seatId, i) => (
                  <SeatCell key={`${zone.id}-${i}`} emp={seatId ? empMap[seatId] || null : null} />
                ))}
              </div>
              {/* フッター席 */}
              {zone.footerSeat && (
                <div style={{ marginTop: 8 }}>
                  <SeatCell emp={empMap[zone.footerSeat] || null} />
                </div>
              )}
            </GlassPanel>
          ))}
        </div>
      ) : (
        /* 一覧グリッドモード */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {filtered.map((emp) => {
            const si = statusIcon(emp.status);
            return (
              <GlassPanel key={emp.id} style={{
                padding: 12, textAlign: "center",
                border: isActive(emp.status) ? `2px solid ${C.accentGreen}` : undefined,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>{emp.name}</div>
                <div style={{ fontSize: 10, color: roleColor(emp.role), fontWeight: 600, marginBottom: 6 }}>{emp.role}</div>
                <div style={{ fontSize: 16, marginBottom: 2 }}>{si.icon}</div>
                <div style={{ fontSize: 11, color: si.color, fontWeight: 600 }}>{emp.status}</div>
                {emp.sec > 0 && <div style={{ fontSize: 10, fontFamily: "monospace", color: C.textMuted, marginTop: 2 }}>{fmt(emp.sec)}</div>}
              </GlassPanel>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        責任者専用 • リアルタイム在席状況 • 座席レイアウトはカスタマイズ可能
      </div>
    </div>
  );
}
