"use client";

/**
 * Garden-Tree 有効率ランキング画面 (/tree/ranking)
 *
 * プロトタイプの <EffRankingScreen /> を移植。
 *
 * 構成:
 *  1. 最終更新タイムスタンプ + 手動更新ボタン
 *  2. サマリーカード（出社人数 / 全体有効率 / 総コール数 / 総接続数）
 *  3. ランキングテーブル（有効率バー付き8列）
 *
 * - 30秒ごと自動更新（useEffect + setInterval）
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useEffect, useState } from "react";

import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";

type Member = {
  rank: number;
  name: string;
  dept: string;
  status: string;
  eff: number;
  calls: number;
  connects: number;
  hours: number;
  online: boolean;
};

const DEMO_MEMBERS: Member[] = [
  { rank: 1, name: "林 佳音", dept: "テレマ", status: "プラチナ", eff: 0.37, calls: 19, connects: 7, hours: 3.5, online: true },
  { rank: 2, name: "信田 優希", dept: "テレマ", status: "ブラック", eff: 0.32, calls: 35, connects: 11, hours: 5.0, online: true },
  { rank: 3, name: "萩尾 拓也", dept: "関電", status: "社員", eff: 0.32, calls: 63, connects: 20, hours: 7.0, online: true },
  { rank: 4, name: "小泉 翔", dept: "社員", status: "社員", eff: 0.28, calls: 86, connects: 24, hours: 8.0, online: true },
  { rank: 5, name: "石原 孝志朗", dept: "社員", status: "社員", eff: 0.27, calls: 79, connects: 21, hours: 7.5, online: true },
  { rank: 6, name: "辻 舞由子", dept: "社員", status: "社員", eff: 0.24, calls: 50, connects: 12, hours: 6.0, online: true },
  { rank: 7, name: "南薗 優樹", dept: "テレマ", status: "ゴールド", eff: 0.21, calls: 68, connects: 14, hours: 7.0, online: true },
  { rank: 8, name: "桐井 大輔", dept: "関電", status: "社員", eff: 0.19, calls: 63, connects: 12, hours: 7.0, online: true },
  { rank: 9, name: "宮永 ひかり", dept: "社員", status: "社員", eff: 0.14, calls: 79, connects: 11, hours: 8.0, online: true },
  { rank: 10, name: "田中 実花", dept: "テレマ", status: "プラチナ", eff: 0.10, calls: 57, connects: 6, hours: 6.5, online: true },
  { rank: 11, name: "三好 理央", dept: "社員", status: "社員", eff: 0.04, calls: 20, connects: 1, hours: 3.0, online: true },
  { rank: 12, name: "劉 恵美", dept: "テレマ", status: "シルバー", eff: 0.01, calls: 43, connects: 0, hours: 5.0, online: true },
  { rank: 13, name: "森 健登", dept: "テレマ", status: "ゴールド", eff: 0.00, calls: 78, connects: 0, hours: 7.5, online: true },
  { rank: 14, name: "谷本 結那", dept: "テレマ", status: "シルバー", eff: 0.00, calls: 58, connects: 0, hours: 6.0, online: true },
];

function fmtTime(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function statusColor(s: string): string {
  if (s === "ブラック") return "#333";
  if (s === "プラチナ") return "#6a7b8a";
  if (s === "ゴールド") return C.gold;
  if (s === "シルバー") return "#999";
  return C.midGreen;
}

function effColor(e: number): string {
  if (e >= 0.25) return C.midGreen;
  if (e >= 0.15) return C.gold;
  if (e >= 0.05) return "#e67e22";
  return C.red;
}

function medalIcon(r: number): string {
  if (r === 1) return "🥇";
  if (r === 2) return "🥈";
  if (r === 3) return "🥉";
  return `${r}`;
}

export default function EffRankingPage() {
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  // 30秒ごと自動更新
  useEffect(() => {
    const iv = setInterval(() => {
      setLastUpdated(new Date());
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const members = DEMO_MEMBERS;
  const avgEff = members.reduce((s, m) => s + m.eff, 0) / members.length;
  const totalCalls = members.reduce((s, m) => s + m.calls, 0);
  const totalConnects = members.reduce((s, m) => s + m.connects, 0);

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#3478c6">📈 有効率ランキング（当日・出社メンバー）</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* 更新タイムスタンプ */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, fontSize: 11, color: C.textMuted, alignItems: "center" }}>
        <span>最終更新: {fmtTime(lastUpdated)}</span>
        <span
          onClick={() => setLastUpdated(new Date())}
          style={{ marginLeft: 8, cursor: "pointer", color: "#3478c6", fontWeight: 600 }}
        >🔄 更新</span>
      </div>

      {/* サマリーカード */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <GlassPanel style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>出社人数</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.textDark }}>{members.length}<span style={{ fontSize: 16, fontWeight: 600 }}>名</span></div>
        </GlassPanel>
        <GlassPanel style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>全体有効率</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: effColor(avgEff) }}>{(avgEff * 100).toFixed(1)}<span style={{ fontSize: 16, fontWeight: 600 }}>%</span></div>
        </GlassPanel>
        <GlassPanel style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>総コール数</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.textDark }}>{totalCalls}<span style={{ fontSize: 16, fontWeight: 600 }}>件</span></div>
        </GlassPanel>
        <GlassPanel style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>総接続数</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.midGreen }}>{totalConnects}<span style={{ fontSize: 16, fontWeight: 600 }}>件</span></div>
        </GlassPanel>
      </div>

      {/* ランキングテーブル */}
      <GlassPanel style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "50px 70px 1fr 90px 100px 80px 80px 70px",
          padding: "12px 16px", background: "linear-gradient(135deg, #3478c6, #5a9ac6)",
          color: C.white, fontSize: 11, fontWeight: 700, gap: 8,
        }}>
          <div>#</div><div>部署</div><div>氏名</div><div>ステータス</div>
          <div style={{ textAlign: "right" }}>有効率</div>
          <div style={{ textAlign: "right" }}>コール</div>
          <div style={{ textAlign: "right" }}>接続数</div>
          <div style={{ textAlign: "right" }}>稼働h</div>
        </div>
        {members.map((m, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "50px 70px 1fr 90px 100px 80px 80px 70px",
            padding: "12px 16px", gap: 8, alignItems: "center",
            background: i < 3 ? `rgba(52,120,198,${0.06 - i * 0.015})` : (i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)"),
            borderBottom: "1px solid rgba(0,0,0,0.04)", fontSize: 13, color: C.textDark,
          }}>
            <div style={{ fontSize: m.rank <= 3 ? 20 : 14, fontWeight: 800, color: m.rank <= 3 ? "#3478c6" : C.textMuted, textAlign: "center" }}>{medalIcon(m.rank)}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{m.dept}</div>
            <div style={{ fontWeight: 700 }}>{m.name}</div>
            <div><span style={{ fontSize: 12, color: statusColor(m.status), fontWeight: 600 }}>{m.status}</span></div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                <div style={{ width: 50, height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, m.eff * 200)}%`, height: "100%", borderRadius: 3, background: effColor(m.eff) }} />
                </div>
                <span style={{ fontWeight: 800, color: effColor(m.eff), minWidth: 42 }}>{(m.eff * 100).toFixed(0)}<span style={{ fontSize: 10 }}>%</span></span>
              </div>
            </div>
            <div style={{ textAlign: "right", color: C.textSub }}>{m.calls}<span style={{ fontSize: 10 }}>件</span></div>
            <div style={{ textAlign: "right", fontWeight: 600, color: m.connects > 0 ? C.midGreen : C.textMuted }}>{m.connects}<span style={{ fontSize: 10 }}>件</span></div>
            <div style={{ textAlign: "right", color: C.textSub }}>{m.hours}<span style={{ fontSize: 10 }}>h</span></div>
          </div>
        ))}
      </GlassPanel>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        当日出社メンバーのみ表示 • 30秒ごと自動更新 • 入力反映は即時 • データはGarden Treeから自動取得
      </div>
    </div>
  );
}
