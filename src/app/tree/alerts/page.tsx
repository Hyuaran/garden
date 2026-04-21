"use client";

/**
 * Garden-Tree アラート管理画面 (/tree/alerts)
 *
 * プロトタイプの <AlertsScreen /> を移植。
 *
 * 構成:
 *  1. サマリー（累計アラート / 未対応 / チェック間隔）
 *  2. ウォッチリスト（頻度別の要注意メンバー）
 *  3. 日別アラート履歴（バッジワークフロー: 要フォロー→確認済み）
 *
 * - MANAGER専用画面
 * - バッジクリック → 確認フロー → メモ入力 → Chatwork通知（デモ）
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useState } from "react";

import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";

/* ---------- 型定義 ---------- */

type AlertItem = {
  id: string;
  name: string;
  eff: number;
  time: string;
  status: string;
  note: string;
};

type AlertDay = {
  date: string;
  items: AlertItem[];
};

/* ---------- デモデータ ---------- */

const ALERT_HISTORY: AlertDay[] = [
  {
    date: "4/16（水）",
    items: [
      { id: "a1", name: "森 健登", eff: 0.0, time: "10:30", status: "要フォロー", note: "架電78件中接続0件" },
      { id: "a2", name: "谷本 結那", eff: 0.0, time: "10:30", status: "要フォロー", note: "架電58件中接続0件" },
      { id: "a3", name: "劉 恵美", eff: 0.01, time: "10:00", status: "要フォロー", note: "有効率1%未満" },
    ],
  },
  {
    date: "4/15（火）",
    items: [
      { id: "a4", name: "森 健登", eff: 0.02, time: "16:00", status: "確認済み", note: "リスト品質の問題あり" },
      { id: "a5", name: "三好 理央", eff: 0.03, time: "14:00", status: "確認済み", note: "午前中離席多め" },
      { id: "a6", name: "谷本 結那", eff: 0.04, time: "11:00", status: "要フォロー", note: "トーク改善の余地あり" },
    ],
  },
  {
    date: "4/14（月）",
    items: [
      { id: "a7", name: "劉 恵美", eff: 0.0, time: "15:30", status: "確認済み", note: "体調不良でパフォーマンス低下" },
      { id: "a8", name: "森 健登", eff: 0.01, time: "11:00", status: "確認済み", note: "連続3日アラート対象" },
    ],
  },
  {
    date: "4/11（金）",
    items: [
      { id: "a9", name: "森 健登", eff: 0.02, time: "16:00", status: "確認済み", note: "トーク研修実施済み" },
      { id: "a10", name: "田中 実花", eff: 0.05, time: "14:00", status: "確認済み", note: "ギリギリ基準値" },
    ],
  },
];

/* ---------- ヘルパー ---------- */

function dangerLevel(count: number): "danger" | "warning" | "normal" {
  if (count >= 4) return "danger";
  if (count >= 2) return "warning";
  return "normal";
}

const dangerColor = { danger: C.red, warning: "#e67e22", normal: C.textMuted };

/* ---------- コンポーネント ---------- */

export default function AlertsPage() {
  const [badgeStates, setBadgeStates] = useState<Record<string, string>>({});
  const [memoInputId, setMemoInputId] = useState<string | null>(null);
  const [memoTexts, setMemoTexts] = useState<Record<string, string>>({});

  const allItems = ALERT_HISTORY.flatMap((d) => d.items);
  const totalAlerts = allItems.length;
  const unresolvedCount = allItems.filter((a) => (badgeStates[a.id] || a.status) === "要フォロー").length;

  // ウォッチリスト: 名前別集計
  const personCount: Record<string, number> = {};
  allItems.forEach((a) => { personCount[a.name] = (personCount[a.name] || 0) + 1; });
  const watchList = Object.entries(personCount).sort((a, b) => b[1] - a[1]);
  const maxCount = watchList[0]?.[1] || 1;

  const getBadgeStatus = (a: AlertItem) => badgeStates[a.id] || a.status;

  const handleBadgeClick = (a: AlertItem) => {
    const current = getBadgeStatus(a);
    if (current === "確認済み") return;
    if (current === "フォロー完了ですか？") {
      setMemoInputId(a.id);
      return;
    }
    setBadgeStates((prev) => ({ ...prev, [a.id]: "フォロー完了ですか？" }));
    // 3秒後に自動リバート
    setTimeout(() => {
      setBadgeStates((prev) => {
        if (prev[a.id] === "フォロー完了ですか？") return { ...prev, [a.id]: "要フォロー" };
        return prev;
      });
    }, 3000);
  };

  const handleConfirmWithMemo = (a: AlertItem) => {
    setBadgeStates((prev) => ({ ...prev, [a.id]: "確認済み" }));
    setMemoInputId(null);
  };

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color={C.red}>🚨 アラート管理</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* サマリー */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <GlassPanel style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>累計アラート</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.textDark }}>{totalAlerts}<span style={{ fontSize: 14, fontWeight: 600 }}>件</span></div>
        </GlassPanel>
        <GlassPanel style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>未対応</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: unresolvedCount > 0 ? C.red : C.midGreen }}>{unresolvedCount}<span style={{ fontSize: 14, fontWeight: 600 }}>件</span></div>
        </GlassPanel>
        <GlassPanel style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>チェック間隔</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.textDark }}>30<span style={{ fontSize: 14, fontWeight: 600 }}>分</span></div>
        </GlassPanel>
      </div>

      {/* ウォッチリスト */}
      <GlassPanel style={{ padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 12 }}>⚠️ ウォッチリスト（アラート頻度順）</div>
        {watchList.map(([name, count]) => {
          const level = dangerLevel(count);
          return (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
              <div style={{ width: 100, fontSize: 13, fontWeight: 600, color: dangerColor[level] }}>{name}</div>
              <div style={{ flex: 1, height: 8, background: "rgba(0,0,0,0.04)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${(count / maxCount) * 100}%`, height: "100%", borderRadius: 4,
                  background: dangerColor[level],
                }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: dangerColor[level], minWidth: 30, textAlign: "right" }}>{count}<span style={{ fontSize: 10 }}>回</span></div>
              <div style={{
                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                background: `${dangerColor[level]}15`, color: dangerColor[level],
              }}>{level === "danger" ? "要注意" : level === "warning" ? "注意" : "通常"}</div>
            </div>
          );
        })}
      </GlassPanel>

      {/* 日別アラート履歴 */}
      {ALERT_HISTORY.map((day) => (
        <div key={day.date} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>{day.date}</div>
          {day.items.map((a) => {
            const status = getBadgeStatus(a);
            const isResolved = status === "確認済み";
            return (
              <GlassPanel key={a.id} style={{
                padding: 14, marginBottom: 8, opacity: isResolved ? 0.5 : 1,
                borderLeft: `4px solid ${isResolved ? C.textMuted : C.red}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>{a.name}</span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>有効率 {(a.eff * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{a.time}</span>
                  </div>
                  <button
                    onClick={() => handleBadgeClick(a)}
                    style={{
                      padding: "4px 12px", borderRadius: 8, border: "none", cursor: isResolved ? "default" : "pointer",
                      fontSize: 11, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
                      background: isResolved ? "rgba(45,106,79,0.1)" : status === "フォロー完了ですか？" ? "rgba(230,126,34,0.15)" : "rgba(214,48,49,0.1)",
                      color: isResolved ? C.midGreen : status === "フォロー完了ですか？" ? "#e67e22" : C.red,
                      transition: "all 0.2s",
                    }}
                  >
                    {status}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{a.note}</div>
                {/* メモ入力 */}
                {memoInputId === a.id && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="text"
                      value={memoTexts[a.id] || ""}
                      onChange={(e) => setMemoTexts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      placeholder="メモ（Chatwork通知に添付）"
                      style={{
                        flex: 1, padding: "6px 10px", borderRadius: 8,
                        border: "1px solid rgba(0,0,0,0.1)", fontSize: 12,
                        fontFamily: "'Noto Sans JP', sans-serif", outline: "none",
                      }}
                    />
                    <button
                      onClick={() => handleConfirmWithMemo(a)}
                      style={{
                        padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                        fontSize: 11, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
                        background: C.midGreen, color: C.white,
                      }}
                    >
                      確認済みにする
                    </button>
                  </div>
                )}
              </GlassPanel>
            );
          })}
        </div>
      ))}

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        責任者専用 • 有効率低下メンバーを自動検知 • フォロー確認でChatwork通知
      </div>
    </div>
  );
}
