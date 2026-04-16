"use client";

/**
 * Garden-Tree トス待ち一覧画面 (/tree/toss-wait)
 *
 * プロトタイプの <TossWaitScreen /> を移植。
 *
 * 構成:
 *  1. サマリーカード（合計トス数 / 待ち件数 / 見込み以上 / 受注 / 失注）
 *  2. クローザー空き状況パネル（SPROUT以外）
 *  3. トッサー別件数グリッド
 *  4. 待ちキュー（リアルタイム経過タイマー付き）
 *  5. 完了アイテム一覧
 *
 * - 1秒ごとの経過タイマー（closer未割当の待機時間を計測）
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useEffect, useState } from "react";

import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { ROLES } from "../_constants/roles";
import { useTreeState } from "../_state/TreeStateContext";

/* ---------- 型定義 ---------- */

type TossItem = {
  id: string;
  customer: string;
  address: string;
  phone: string;
  tosser: string;
  memo: string;
  time: string;
  elapsed: number;
  closer: string | null;
  closerStatus: string;
  closerSec: number;
  result: string | null;
};

type CompletedItem = {
  id: string;
  customer: string;
  phone: string;
  tosser: string;
  closer: string;
  time: string;
  result: string;
  resultColor: string;
};

type Closer = {
  name: string;
  status: "free" | "busy";
  sec: number;
  color: string;
};

/* ---------- デモデータ ---------- */

const DEMO_QUEUE: TossItem[] = [
  { id: "t1", customer: "田中工業 様", address: "大阪市北区梅田1-2-3", phone: "06-1234-5678", tosser: "信田 優希", memo: "社長直通、電気代月50万以上", time: "10:32", elapsed: 185, closer: null, closerStatus: "", closerSec: 0, result: null },
  { id: "t2", customer: "鈴木商事 様", address: "神戸市中央区三宮5-6", phone: "078-9876-5432", tosser: "林 佳音", memo: "担当者指名あり（山田様）", time: "10:28", elapsed: 425, closer: "萩尾 拓也", closerStatus: "通話中", closerSec: 78, result: null },
];

const DEMO_COMPLETED: CompletedItem[] = [
  { id: "c1", customer: "佐藤建設 様", phone: "06-1111-2222", tosser: "南薗 優樹", closer: "小泉 翔", time: "10:15", result: "見込み", resultColor: C.midGreen },
  { id: "c2", customer: "中村電機 様", phone: "06-3333-4444", tosser: "信田 優希", closer: "萩尾 拓也", time: "10:02", result: "受注", resultColor: C.gold },
  { id: "c3", customer: "山本商店 様", phone: "078-5555-6666", tosser: "林 佳音", closer: "石原 孝志朗", time: "09:48", result: "NG", resultColor: C.red },
  { id: "c4", customer: "高橋製作所 様", phone: "06-7777-8888", tosser: "桐井 大輔", closer: "小泉 翔", time: "09:35", result: "見込み", resultColor: C.midGreen },
  { id: "c5", customer: "伊藤不動産 様", phone: "06-2222-3333", tosser: "南薗 優樹", closer: "萩尾 拓也", time: "09:22", result: "失注", resultColor: "#888" },
  { id: "c6", customer: "加藤物流 様", phone: "078-4444-5555", tosser: "信田 優希", closer: "石原 孝志朗", time: "09:10", result: "受注", resultColor: C.gold },
  { id: "c7", customer: "松本工務店 様", phone: "06-6666-7777", tosser: "林 佳音", closer: "小泉 翔", time: "09:01", result: "NG", resultColor: C.red },
  { id: "c8", customer: "渡辺食品 様", phone: "06-8888-9999", tosser: "桐井 大輔", closer: "萩尾 拓也", time: "08:52", result: "見込み", resultColor: C.midGreen },
  { id: "c9", customer: "吉田精密 様", phone: "078-1111-0000", tosser: "南薗 優樹", closer: "石原 孝志朗", time: "08:40", result: "受注", resultColor: C.gold },
];

const CLOSERS: Closer[] = [
  { name: "萩尾 拓也", status: "busy", sec: 78, color: C.midGreen },
  { name: "小泉 翔", status: "free", sec: 0, color: C.midGreen },
  { name: "石原 孝志朗", status: "free", sec: 0, color: C.midGreen },
  { name: "辻 舞由子", status: "busy", sec: 245, color: C.midGreen },
];

const ACTIVE_TOSS_MEMBERS = ["信田 優希", "林 佳音", "南薗 優樹", "桐井 大輔", "田中 実花", "森 健登", "谷本 結那", "劉 恵美"];

/* ---------- ヘルパー ---------- */

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* ---------- コンポーネント ---------- */

export default function TossWaitPage() {
  const { role } = useTreeState();
  const [tossQueue, setTossQueue] = useState(DEMO_QUEUE);
  const [elapsedTimers, setElapsedTimers] = useState<Record<string, number>>({});

  // 1秒ごとの経過タイマー
  useEffect(() => {
    const iv = setInterval(() => {
      setElapsedTimers((prev) => {
        const next = { ...prev };
        tossQueue.forEach((item) => {
          if (!item.closer) {
            next[item.id] = (next[item.id] ?? item.elapsed) + 1;
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [tossQueue]);

  const completedItems = DEMO_COMPLETED;
  const totalTossCount = tossQueue.length + completedItems.length;

  // トッサー別件数
  const tosserCounts: Record<string, number> = {};
  [...tossQueue, ...completedItems].forEach((item) => {
    tosserCounts[item.tosser] = (tosserCounts[item.tosser] || 0) + 1;
  });
  const sortedTossers = Object.entries(tosserCounts).sort((a, b) => b[1] - a[1]);

  // サマリー算出
  const waitCount = tossQueue.filter((t) => !t.result).length;
  const prospectCount = completedItems.filter((c) => c.result === "見込み" || c.result === "受注").length;
  const orderCount = completedItems.filter((c) => c.result === "受注").length;
  const lostCount = completedItems.filter((c) => c.result === "失注" || c.result === "NG").length;

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#e67e22">📋 クローザー待ち（トス一覧）</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* サマリーカード */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "合計トス数", val: totalTossCount, unit: "件", color: C.textDark },
          { label: "待ち件数", val: waitCount, unit: "件", color: "#e67e22" },
          { label: "見込み以上", val: prospectCount, unit: "件", color: C.midGreen },
          { label: "受注", val: orderCount, unit: "件", color: C.gold },
          { label: "失注", val: lostCount, unit: "件", color: C.red },
        ].map((s) => (
          <GlassPanel key={s.label} style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}<span style={{ fontSize: 14, fontWeight: 600 }}>{s.unit}</span></div>
          </GlassPanel>
        ))}
      </div>

      {/* クローザー空き状況（SPROUT以外） */}
      {role !== ROLES.SPROUT && (
        <GlassPanel style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textDark, marginBottom: 10 }}>クローザー空き状況</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {CLOSERS.map((cl) => (
              <div key={cl.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: cl.status === "free" ? "rgba(45,106,79,0.06)" : "rgba(0,0,0,0.02)", borderRadius: 10 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: cl.status === "free" ? C.midGreen : "#e67e22",
                  animation: cl.status === "busy" ? "pulse 1.5s infinite" : undefined,
                }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{cl.name}</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>
                  {cl.status === "free" ? "空き" : `通話中 ${fmt(cl.sec)}`}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* トッサー別件数 */}
      <GlassPanel style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textDark, marginBottom: 10 }}>トッサー別件数</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {sortedTossers.map(([name, count]) => (
            <div key={name} style={{ textAlign: "center", padding: "6px 4px", background: "rgba(0,0,0,0.02)", borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{name}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#3478c6" }}>{count}<span style={{ fontSize: 10 }}>件</span></div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* 待ちキュー */}
      {tossQueue.map((item) => {
        const elapsed = elapsedTimers[item.id] ?? item.elapsed;
        const isLong = elapsed >= 300;
        return (
          <GlassPanel
            key={item.id}
            onClick={() => {/* navigate to call with confirm mode */}}
            style={{
              padding: 16, marginBottom: 12, cursor: "pointer",
              borderLeft: `4px solid ${isLong ? "#e67e22" : C.midGreen}`,
              transition: "box-shadow 0.2s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>{item.customer}</span>
                <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 12 }}>{item.phone}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {item.closer && <span style={{ fontSize: 10, color: C.textMuted }}>⏸</span>}
                <span style={{
                  fontSize: 14, fontWeight: 800, fontFamily: "monospace",
                  color: isLong ? "#e67e22" : C.midGreen,
                }}>
                  {fmt(elapsed)}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.textSub, marginBottom: 6 }}>
              <span>{item.address}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                <span style={{ color: C.textMuted }}>トッサー: <span style={{ fontWeight: 600, color: C.textDark }}>{item.tosser}</span></span>
                <span style={{ color: C.textMuted }}>到着: {item.time}</span>
              </div>
              {item.closer && (
                <div style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: C.textMuted }}>クローザー:</span>
                  <span style={{ fontWeight: 600, color: C.gold }}>{item.closer}</span>
                  <span style={{ fontSize: 10, background: "rgba(201,168,76,0.15)", color: C.goldDark, padding: "2px 8px", borderRadius: 8 }}>{item.closerStatus}</span>
                </div>
              )}
            </div>
            {item.memo && (
              <div style={{ marginTop: 6, fontSize: 11, color: C.textSub, background: "rgba(0,0,0,0.02)", padding: "4px 8px", borderRadius: 6 }}>
                {item.memo}
              </div>
            )}
          </GlassPanel>
        );
      })}

      {/* 完了アイテム */}
      <div style={{ marginTop: 24, marginBottom: 8, fontSize: 13, fontWeight: 700, color: C.textMuted }}>完了済み（{completedItems.length}件）</div>
      <GlassPanel style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 120px 100px 100px 80px 80px 70px",
          padding: "10px 16px", background: "rgba(0,0,0,0.04)", fontSize: 11, fontWeight: 700, color: C.textMuted, gap: 8,
        }}>
          <div>顧客名</div><div>電話番号</div><div>トッサー</div><div>クローザー</div>
          <div>時刻</div><div>結果</div><div />
        </div>
        {completedItems.map((item) => (
          <div key={item.id} style={{
            display: "grid", gridTemplateColumns: "1fr 120px 100px 100px 80px 80px 70px",
            padding: "10px 16px", fontSize: 12, color: C.textSub, gap: 8,
            opacity: 0.5, borderBottom: "1px solid rgba(0,0,0,0.03)",
          }}>
            <div>{item.customer}</div>
            <div>{item.phone}</div>
            <div>{item.tosser}</div>
            <div>{item.closer}</div>
            <div>{item.time}</div>
            <div style={{ fontWeight: 700, color: item.resultColor }}>{item.result}</div>
            <div style={{ cursor: "pointer", color: "#3478c6", fontSize: 11 }}>詳細</div>
          </div>
        ))}
      </GlassPanel>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        トスを受けたらキューに自動追加 • 1秒ごとリアルタイム更新 • 5分超過で警告表示
      </div>
    </div>
  );
}
