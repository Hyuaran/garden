"use client";

/**
 * Garden-Tree 横断検索画面 (/tree/search)
 *
 * プロトタイプの <SearchScreen /> を移植。
 *
 * 構成:
 *  1. 検索入力バー
 *  2. 4カテゴリの検索結果（顧客 / Q&A / 見込み / ヒアリング）
 *  3. 各結果カードからの画面遷移
 *
 * - 全データを横断検索するハブ画面
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useState } from "react";

import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";

/* ---------- デモデータ ---------- */

const DEMO_RESULTS = {
  customers: [
    { name: "田中工業 様", phone: "06-1234-5678", address: "大阪市北区梅田1-2-3", lastResult: "見込み", lastDate: "4/14" },
    { name: "鈴木商事 様", phone: "078-9876-5432", address: "神戸市中央区三宮5-6", lastResult: "受注", lastDate: "4/15" },
  ],
  qa: [
    { q: "料金プランの比較方法を教えてください", tag: "プレゼン" },
    { q: "解約違約金について聞かれたら？", tag: "アウト返し" },
  ],
  prospects: [
    { rank: "A", customer: "佐藤建設 様", date: "4/14", memo: "社長決裁待ち、来週再コール" },
  ],
  hearings: [
    { customer: "中村電機 様", date: "4/13", result: "見込み", memo: "月額50万以上、切替意欲あり" },
    { customer: "高橋製作所 様", date: "4/12", result: "再コール", memo: "担当者不在、木曜午後に再架電" },
    { customer: "伊藤不動産 様", date: "4/11", result: "NG", memo: "既に他社で切替済み" },
  ],
};

/* ---------- コンポーネント ---------- */

export default function SearchPage() {
  const [query, setQuery] = useState("");

  const sections: { key: string; label: string; icon: string; count: number }[] = [
    { key: "customers", label: "顧客", icon: "👤", count: DEMO_RESULTS.customers.length },
    { key: "qa", label: "Q&A", icon: "❓", count: DEMO_RESULTS.qa.length },
    { key: "prospects", label: "見込み", icon: "⭐", count: DEMO_RESULTS.prospects.length },
    { key: "hearings", label: "ヒアリング", icon: "📋", count: DEMO_RESULTS.hearings.length },
  ];

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#3478c6">🔍 横断検索</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* 検索バー */}
      <div style={{ position: "relative", marginBottom: 24 }}>
        <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: C.textMuted }}>
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="顧客名・Q&A・見込み・ヒアリングを横断検索..."
          style={{
            width: "100%", padding: "14px 16px 14px 48px", borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.08)", fontSize: 15,
            fontFamily: "'Noto Sans JP', sans-serif", outline: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
          }}
        />
      </div>

      {/* 顧客 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>👤</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>顧客</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>({DEMO_RESULTS.customers.length}件)</span>
        </div>
        {DEMO_RESULTS.customers.map((c) => (
          <GlassPanel key={c.name} style={{ padding: 14, marginBottom: 8, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>{c.name}</span>
                <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 12 }}>{c.phone}</span>
                <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 12 }}>{c.address}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: C.textMuted }}>{c.lastDate}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                  background: c.lastResult === "受注" ? "rgba(201,168,76,0.15)" : "rgba(45,106,79,0.1)",
                  color: c.lastResult === "受注" ? C.gold : C.midGreen,
                }}>{c.lastResult}</span>
              </div>
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* Q&A */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>❓</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>Q&A</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>({DEMO_RESULTS.qa.length}件)</span>
        </div>
        {DEMO_RESULTS.qa.map((q) => (
          <GlassPanel key={q.q} style={{ padding: 14, marginBottom: 8, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: C.textDark }}>{q.q}</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 8, background: "rgba(52,120,198,0.1)", color: "#3478c6" }}>{q.tag}</span>
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* 見込み */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>見込み</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>({DEMO_RESULTS.prospects.length}件)</span>
        </div>
        {DEMO_RESULTS.prospects.map((p) => (
          <GlassPanel key={p.customer} style={{ padding: 14, marginBottom: 8, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, background: "rgba(201,168,76,0.15)", color: C.gold,
                }}>{p.rank}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>{p.customer}</span>
              </div>
              <span style={{ fontSize: 11, color: C.textMuted }}>{p.date}</span>
            </div>
            <div style={{ fontSize: 12, color: C.textSub }}>{p.memo}</div>
          </GlassPanel>
        ))}
      </div>

      {/* ヒアリング */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>ヒアリング</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>({DEMO_RESULTS.hearings.length}件)</span>
        </div>
        {DEMO_RESULTS.hearings.map((h) => (
          <GlassPanel key={h.customer} style={{ padding: 14, marginBottom: 8, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>{h.customer}</span>
                <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 12 }}>{h.date}</span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                background: h.result === "見込み" ? "rgba(45,106,79,0.1)" : h.result === "再コール" ? "rgba(52,120,198,0.1)" : "rgba(214,48,49,0.1)",
                color: h.result === "見込み" ? C.midGreen : h.result === "再コール" ? "#3478c6" : C.red,
              }}>{h.result}</span>
            </div>
            <div style={{ fontSize: 12, color: C.textSub }}>{h.memo}</div>
          </GlassPanel>
        ))}
      </div>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        顧客・Q&A・見込み・ヒアリングを横断検索 • クリックで各画面に遷移 • リアルタイムデータ
      </div>
    </div>
  );
}
