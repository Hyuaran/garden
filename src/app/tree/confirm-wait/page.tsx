"use client";

/**
 * Garden-Tree 前確・後確待ち一覧画面 (/tree/confirm-wait)
 *
 * プロトタイプの <ConfirmWaitScreen /> を移植。
 *
 * 構成:
 *  1. サマリー（合計待ち + 前確/後確/フォローコール 詳細）
 *  2. フィルタボタン（全て / 前確 / 後確 / フォローコール）
 *  3. 確認者空き状況パネル
 *  4. キューカード（種別バッジ・リアルタイム入力タイマー）
 *  5. 完了アイテム一覧
 *
 * - 1秒ごと入力中タイマー（useEffect + setInterval）
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useEffect, useState } from "react";

import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";

/* ---------- 型定義 ---------- */

type ConfirmType = "前確" | "後確" | "フォローコール";

type ConfirmItem = {
  id: string;
  type: ConfirmType;
  customer: string;
  phone: string;
  closer: string;
  confirmer: string | null;
  confirmerStatus: string;
  confirmerSec: number;
  time: string;
  inputSec: number;
  status: string;
  scheduledTime?: string;
  followInfo?: string;
};

type CompletedConfirm = {
  type: ConfirmType;
  customer: string;
  closer: string;
  confirmer: string;
  time: string;
  result: string;
  resultColor: string;
};

type ConfirmerInfo = {
  name: string;
  status: "free" | "busy";
  sec: number;
  color: string;
};

/* ---------- デモデータ ---------- */

const DEMO_QUEUE: ConfirmItem[] = [
  { id: "cw1", type: "前確", customer: "田中工業 様", phone: "06-1234-5678", closer: "萩尾 拓也", confirmer: null, confirmerStatus: "", confirmerSec: 0, time: "10:45", inputSec: 0, status: "待ち" },
  { id: "cw2", type: "前確", customer: "鈴木商事 様", phone: "078-9876-5432", closer: "小泉 翔", confirmer: "辻 舞由子", confirmerStatus: "入力中", confirmerSec: 0, time: "10:38", inputSec: 95, status: "入力中" },
  { id: "cw3", type: "後確", customer: "佐藤建設 様", phone: "06-1111-2222", closer: "萩尾 拓也", confirmer: null, confirmerStatus: "", confirmerSec: 0, time: "10:32", inputSec: 0, status: "待ち", scheduledTime: "14:00" },
  { id: "cw4", type: "後確", customer: "中村電機 様", phone: "06-3333-4444", closer: "石原 孝志朗", confirmer: "宮永 ひかり", confirmerStatus: "通話中", confirmerSec: 45, time: "10:20", inputSec: 0, status: "対応中", scheduledTime: "15:30" },
  { id: "cw5", type: "フォローコール", customer: "高橋製作所 様", phone: "06-7777-8888", closer: "小泉 翔", confirmer: null, confirmerStatus: "", confirmerSec: 0, time: "10:15", inputSec: 0, status: "待ち", scheduledTime: "16:00", followInfo: "電力プランA / WEB / 開通4/20" },
];

const DEMO_COMPLETED: CompletedConfirm[] = [
  { type: "前確", customer: "山本商店 様", closer: "萩尾 拓也", confirmer: "辻 舞由子", time: "10:10", result: "前確OK", resultColor: C.midGreen },
  { type: "前確", customer: "加藤物流 様", closer: "小泉 翔", confirmer: "宮永 ひかり", time: "09:55", result: "担不", resultColor: "#e67e22" },
  { type: "後確", customer: "松本工務店 様", closer: "石原 孝志朗", confirmer: "辻 舞由子", time: "09:40", result: "後確OK", resultColor: C.midGreen },
  { type: "前確", customer: "渡辺食品 様", closer: "萩尾 拓也", confirmer: "宮永 ひかり", time: "09:25", result: "NG", resultColor: C.red },
  { type: "後確", customer: "吉田精密 様", closer: "小泉 翔", confirmer: "辻 舞由子", time: "09:10", result: "後確NG", resultColor: C.red },
];

const CONFIRMERS: ConfirmerInfo[] = [
  { name: "辻 舞由子", status: "busy", sec: 95, color: C.midGreen },
  { name: "宮永 ひかり", status: "busy", sec: 45, color: C.midGreen },
  { name: "三好 理央", status: "free", sec: 0, color: C.midGreen },
];

/* ---------- ヘルパー ---------- */

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function typeColor(t: ConfirmType): string {
  if (t === "前確") return "#3478c6";
  if (t === "後確") return "#e67e22";
  return "#10b981";
}

type FilterKey = "all" | "前確" | "後確" | "フォローコール";

/* ---------- コンポーネント ---------- */

export default function ConfirmWaitPage() {
  const [confirmFilter, setConfirmFilter] = useState<FilterKey>("all");
  const [inputTimers, setInputTimers] = useState<Record<string, number>>({});

  // 入力中アイテムのタイマー
  useEffect(() => {
    const iv = setInterval(() => {
      setInputTimers((prev) => {
        const next = { ...prev };
        DEMO_QUEUE.forEach((item) => {
          if (item.status === "入力中") {
            next[item.id] = (next[item.id] ?? item.inputSec) + 1;
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // フィルタリング
  const maeList = DEMO_QUEUE.filter((q) => q.type === "前確");
  const atoList = DEMO_QUEUE.filter((q) => q.type === "後確").sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""));
  const followList = DEMO_QUEUE.filter((q) => q.type === "フォローコール").sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""));
  const allCombined = [...maeList, ...atoList, ...followList];
  const combined = confirmFilter === "all" ? allCombined : allCombined.filter((q) => q.type === confirmFilter);

  // 完了集計
  const maeOK = DEMO_COMPLETED.filter((c) => c.type === "前確" && c.result.includes("OK")).length;
  const maeNG = DEMO_COMPLETED.filter((c) => c.type === "前確" && !c.result.includes("OK")).length;
  const atoOK = DEMO_COMPLETED.filter((c) => c.type === "後確" && c.result.includes("OK")).length;
  const atoNG = DEMO_COMPLETED.filter((c) => c.type === "後確" && !c.result.includes("OK")).length;
  const followDone = DEMO_COMPLETED.filter((c) => c.type === "フォローコール").length;

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "全て", count: allCombined.length },
    { key: "前確", label: "前確", count: maeList.length },
    { key: "後確", label: "後確", count: atoList.length },
    { key: "フォローコール", label: "フォローコール", count: followList.length },
  ];

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#3478c6">✅ 前確・後確待ち一覧</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* サマリー */}
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, marginBottom: 24 }}>
        <GlassPanel style={{ padding: 16, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>合計待ち</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: C.textDark }}>{allCombined.length}</div>
        </GlassPanel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)", gap: 8 }}>
          {[
            { label: "前確待ち", val: maeList.length, color: "#3478c6" },
            { label: "前確OK", val: maeOK, color: C.midGreen },
            { label: "前確NG", val: maeNG, color: C.red },
            { label: "後確待ち", val: atoList.length, color: "#e67e22" },
            { label: "後確OK", val: atoOK, color: C.midGreen },
            { label: "後確NG", val: atoNG, color: C.red },
            { label: "フォローコール", val: followList.length, color: "#10b981" },
            { label: "時間指定あり", val: [...atoList, ...followList].filter((q) => q.scheduledTime).length, color: C.textSub },
            { label: "完了", val: DEMO_COMPLETED.length + followDone, color: C.midGreen },
          ].map((s) => (
            <GlassPanel key={s.label} style={{ padding: "8px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.textMuted }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.val}</div>
            </GlassPanel>
          ))}
        </div>
      </div>

      {/* フィルタボタン */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setConfirmFilter(f.key)}
            style={{
              padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
              background: confirmFilter === f.key ? "#3478c6" : "rgba(0,0,0,0.04)",
              color: confirmFilter === f.key ? C.white : C.textSub,
              transition: "all 0.2s",
            }}
          >
            {f.label}（{f.count}）
          </button>
        ))}
      </div>

      {/* 確認者空き状況 */}
      <GlassPanel style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textDark, marginBottom: 10 }}>確認者 空き状況</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {CONFIRMERS.map((cf) => (
            <div key={cf.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: cf.status === "free" ? "rgba(45,106,79,0.06)" : "rgba(0,0,0,0.02)", borderRadius: 10 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: cf.status === "free" ? C.midGreen : "#e67e22",
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{cf.name}</span>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                {cf.status === "free" ? "空き" : `対応中 ${fmt(cf.sec)}`}
              </span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* キューカード */}
      {combined.map((item) => {
        const inputElapsed = inputTimers[item.id] ?? item.inputSec;
        const isInputLong = inputElapsed >= 120;
        return (
          <GlassPanel
            key={item.id}
            onClick={() => {/* navigate to call with confirm mode */}}
            style={{
              padding: 16, marginBottom: 12, cursor: "pointer",
              borderLeft: `4px solid ${typeColor(item.type)}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: C.white,
                  background: typeColor(item.type), padding: "2px 8px", borderRadius: 8,
                }}>{item.type}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>{item.customer}</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>{item.phone}</span>
              </div>
              {item.scheduledTime && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e67e22", background: "rgba(230,126,34,0.1)", padding: "2px 10px", borderRadius: 8 }}>
                  {item.scheduledTime} 指定
                </span>
              )}
            </div>
            {item.followInfo && (
              <div style={{ fontSize: 11, color: C.textSub, marginBottom: 6, background: "rgba(0,0,0,0.02)", padding: "4px 8px", borderRadius: 6 }}>
                {item.followInfo}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                <span style={{ color: C.textMuted }}>クローザー: <span style={{ fontWeight: 600, color: C.textDark }}>{item.closer}</span></span>
                <span style={{ color: C.textMuted }}>到着: {item.time}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {item.confirmer ? (
                  <>
                    <span style={{ fontSize: 12, color: C.textMuted }}>確認者:</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.gold }}>{item.confirmer}</span>
                    <span style={{ fontSize: 10, background: "rgba(201,168,76,0.15)", color: C.goldDark, padding: "2px 8px", borderRadius: 8 }}>{item.confirmerStatus}</span>
                    {item.status === "入力中" && (
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: isInputLong ? "#e67e22" : C.textSub }}>
                        {fmt(inputElapsed)}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: C.textMuted }}>未割当</span>
                )}
              </div>
            </div>
          </GlassPanel>
        );
      })}

      {/* 完了アイテム */}
      <div style={{ marginTop: 24, marginBottom: 8, fontSize: 13, fontWeight: 700, color: C.textMuted }}>完了済み（{DEMO_COMPLETED.length}件）</div>
      <GlassPanel style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "60px 1fr 100px 100px 80px 80px",
          padding: "10px 16px", background: "rgba(0,0,0,0.04)", fontSize: 11, fontWeight: 700, color: C.textMuted, gap: 8,
        }}>
          <div>種別</div><div>顧客名</div><div>クローザー</div><div>確認者</div><div>時刻</div><div>結果</div>
        </div>
        {DEMO_COMPLETED.map((item, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "60px 1fr 100px 100px 80px 80px",
            padding: "10px 16px", fontSize: 12, color: C.textSub, gap: 8,
            opacity: 0.5, borderBottom: "1px solid rgba(0,0,0,0.03)",
          }}>
            <div><span style={{ fontSize: 10, fontWeight: 600, color: typeColor(item.type) }}>{item.type}</span></div>
            <div>{item.customer}</div>
            <div>{item.closer}</div>
            <div>{item.confirmer}</div>
            <div>{item.time}</div>
            <div style={{ fontWeight: 700, color: item.resultColor }}>{item.result}</div>
          </div>
        ))}
      </GlassPanel>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        前確・後確・フォローコールを一元管理 • 入力中タイマー: 2分超過で警告 • データはGarden Treeから自動取得
      </div>
    </div>
  );
}
