"use client";

/**
 * Garden-Tree 退勤・日報画面 (/tree/wrap-up)
 *
 * プロトタイプの <WrapUpScreen /> を移植。
 *
 * 構成:
 *  1. 今日の実績サマリー（架電数 / 有効率 / アポ / 再コール予定）
 *  2. Q&A履歴サマリー + 追加メモ
 *  3. 離席・休憩ログ（10分超過警告付き）
 *  4. 退勤ボタン（日報送信あり/なし）
 *
 * - ステートレス（stats / ログは TreeState から取得予定）
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useState } from "react";

import { ActionButton } from "../_components/ActionButton";
import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { USER } from "../_constants/user";
import { useTreeState } from "../_state/TreeStateContext";

/* ---------- デモデータ ---------- */

type AwayLogItem = {
  type: "auto" | "manual";
  start: string;
  end: string;
  duration: number; // seconds
  adjustedDuration?: number;
};

type BreakLogItem = {
  type: "lunch" | "short";
  start: string;
  end: string;
  duration: number; // seconds
};

const DEMO_AWAY_LOG: AwayLogItem[] = [
  { type: "auto", start: "09:45", end: "09:48", duration: 180 },
  { type: "manual", start: "11:02", end: "11:15", duration: 780, adjustedDuration: 600 },
  { type: "auto", start: "14:20", end: "14:22", duration: 120 },
  { type: "auto", start: "16:05", end: "16:18", duration: 780 },
];

const DEMO_BREAK_LOG: BreakLogItem[] = [
  { type: "lunch", start: "12:00", end: "13:00", duration: 3600 },
  { type: "short", start: "15:00", end: "15:10", duration: 600 },
];

/* ---------- ヘルパー ---------- */

function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}分${sec > 0 ? `${sec}秒` : ""}`;
  return `${sec}秒`;
}

/* ---------- コンポーネント ---------- */

export default function WrapUpPage() {
  const { stats } = useTreeState();
  const [memo, setMemo] = useState("");

  const totalAway = DEMO_AWAY_LOG.reduce((s, a) => s + (a.adjustedDuration ?? a.duration), 0);
  const totalBreak = DEMO_BREAK_LOG.reduce((s, b) => s + b.duration, 0);

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color={C.midGreen}>🏠 退勤・日報</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* 挨拶 */}
      <GlassPanel style={{ padding: 20, marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.textDark }}>お疲れさまでした、{USER.name}さん！</div>
        <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>本日の実績を確認して退勤してください</div>
      </GlassPanel>

      {/* 今日の実績 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <GlassPanel style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 12 }}>今日の実績</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "架電数", val: `${stats.calls}件`, color: C.textDark },
              { label: "有効率", val: `${stats.efficiency}%`, color: C.midGreen },
              { label: "アポ", val: "2件", color: C.gold },
              { label: "再コール予定", val: "5件", color: "#3478c6" },
            ].map((s) => (
              <div key={s.label} style={{ padding: 8, background: "rgba(0,0,0,0.02)", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.textMuted }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>Q&A履歴サマリー</div>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 8 }}>本日利用したQ&A: 3件</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>追加メモ</div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="日報に追記したい内容があれば入力..."
            style={{
              width: "100%", minHeight: 60, padding: 10, borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.08)", fontSize: 12,
              fontFamily: "'Noto Sans JP', sans-serif", resize: "vertical",
              outline: "none",
            }}
          />
        </GlassPanel>
      </div>

      {/* 離席・休憩ログ */}
      <GlassPanel style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 12 }}>離席・休憩ログ</div>

        {/* サマリー */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
          <div style={{ textAlign: "center", padding: 8, background: "rgba(0,0,0,0.02)", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: C.textMuted }}>離席回数</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.textDark }}>{DEMO_AWAY_LOG.length}<span style={{ fontSize: 10 }}>回</span></div>
          </div>
          <div style={{ textAlign: "center", padding: 8, background: "rgba(0,0,0,0.02)", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: C.textMuted }}>離席合計</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: totalAway >= 1800 ? "#e67e22" : C.textDark }}>{fmtDur(totalAway)}</div>
          </div>
          <div style={{ textAlign: "center", padding: 8, background: "rgba(0,0,0,0.02)", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: C.textMuted }}>休憩合計</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.textDark }}>{fmtDur(totalBreak)}</div>
          </div>
        </div>

        {/* 詳細ログ */}
        {DEMO_AWAY_LOG.map((a, i) => {
          const dur = a.adjustedDuration ?? a.duration;
          const isLong = dur >= 600;
          return (
            <div key={`away-${i}`} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "6px 8px",
              borderBottom: "1px solid rgba(0,0,0,0.03)", fontSize: 12,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6,
                background: a.type === "auto" ? "rgba(52,120,198,0.1)" : "rgba(230,126,34,0.1)",
                color: a.type === "auto" ? "#3478c6" : "#e67e22",
              }}>
                {a.type === "auto" ? "自動" : "手動"}
              </span>
              <span style={{ color: C.textSub }}>{a.start} → {a.end}</span>
              <span style={{ fontWeight: 600, color: isLong ? "#e67e22" : C.textDark }}>{fmtDur(dur)}</span>
              {isLong && <span style={{ fontSize: 10, color: "#e67e22" }}>⚠ 10分超過</span>}
            </div>
          );
        })}
        {DEMO_BREAK_LOG.map((b, i) => (
          <div key={`break-${i}`} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "6px 8px",
            borderBottom: "1px solid rgba(0,0,0,0.03)", fontSize: 12,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6,
              background: "rgba(45,106,79,0.1)", color: C.midGreen,
            }}>
              {b.type === "lunch" ? "昼休憩" : "小休憩"}
            </span>
            <span style={{ color: C.textSub }}>{b.start} → {b.end}</span>
            <span style={{ fontWeight: 600, color: C.textDark }}>{fmtDur(b.duration)}</span>
          </div>
        ))}
      </GlassPanel>

      {/* 退勤ボタン */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
        <ActionButton
          label="日報を送信して退勤"
          color={C.midGreen}
          large
        />
        <ActionButton
          label="送信せず退勤"
          color="rgba(0,0,0,0.06)"
          textColor={C.textSub}
        />
      </div>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        日報はChatworkに自動送信 • 10分超過の離席は管理者に通知 • お疲れさまでした
      </div>
    </div>
  );
}
