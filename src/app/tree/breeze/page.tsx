"use client";

/**
 * Garden-Tree Breeze チャット画面 (/tree/breeze)
 *
 * プロトタイプの <BreezeScreen /> を移植。
 *
 * 構成:
 *  1. チャネル切替ボタン（全体 / トスチーム / クローザーチーム / お知らせ）
 *  2. メッセージ一覧（スクロール可能）
 *  3. メッセージ入力フォーム
 *
 * - 当日限りのメッセージ保持（業務連絡用）
 * - サイドバー・KPIヘッダーは TreeShell が描画
 *
 * --- D-02 Step 9.1: DONE_WITH_CONCERNS ---
 * spec §3.4 では「Breeze = 呼吸連続架電画面（duration_sec 自動取得）」として
 * BreezeDualTimer / QuadTimer を使う架電 UI を想定しているが、
 * 本ファイルは「チームチャット画面」として実装されており構造上の齟齬がある。
 *
 * 現状:
 *  - BreezeDualTimer / 結果ボタン / insertTreeCallRecordWithQueue は本画面に存在しない
 *  - spec §3.4 想定の「呼吸連続架電」機能は calling/sprout/page.tsx が担う
 *
 * 対応方針（D-02 Step 9 スコープ）:
 *  - 本チャット画面への架電 Supabase 連携追加は「構造不一致」として SKIP
 *  - D-04 または仕様再確認フェーズで「Breeze 画面の役割定義（チャットか架電か）」を決定すること
 *  - チャット機能自体は既存実装を維持（変更なし）
 * ---
 */

import { useRef, useState } from "react";

import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { USER } from "../_constants/user";
import { useTreeState } from "../_state/TreeStateContext";

/* ---------- 型定義 ---------- */

type ChatMessage = {
  id: number;
  sender: string;
  role: string;
  text: string;
  time: string;
  isSystem: boolean;
};

/* ---------- デモデータ ---------- */

const CHANNELS = ["全体", "トスチーム", "クローザーチーム", "お知らせ"];

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: 1, sender: "システム", role: "システム", text: "本日の業務を開始しました。皆さんお疲れ様です。", time: "09:00", isSystem: true },
  { id: 2, sender: "東海林 美琴", role: "責任者", text: "おはようございます！今日も一日よろしくお願いします。", time: "09:05", isSystem: false },
  { id: 3, sender: "萩尾 拓也", role: "クローザー", text: "おはようございます。本日もよろしくお願いします。", time: "09:06", isSystem: false },
  { id: 4, sender: "信田 優希", role: "トス", text: "おはようございます！頑張ります！", time: "09:07", isSystem: false },
  { id: 5, sender: "システム", role: "システム", text: "10:00 〜 定例朝礼の時間です。", time: "09:55", isSystem: true },
  { id: 6, sender: "東海林 美琴", role: "責任者", text: "本日の目標: チーム全体で有効率25%以上を目指しましょう。リスト品質の改善が鍵です。", time: "10:10", isSystem: false },
];

/* ---------- ヘルパー ---------- */

function roleColor(r: string): string {
  if (r === "責任者") return "#c44a4a";
  if (r === "クローザー" || r === "クローザ") return C.gold;
  return "#3478c6";
}

function currentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ---------- コンポーネント ---------- */

export default function BreezePage() {
  const { treeUser } = useTreeState();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [newMsg, setNewMsg] = useState("");
  const [channel, setChannel] = useState("全体");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = () => {
    if (!newMsg.trim()) return;
    const msg: ChatMessage = {
      id: Date.now(),
      sender: treeUser?.name ?? USER.fullName,
      role: "責任者",
      text: newMsg.trim(),
      time: currentTime(),
      isSystem: false,
    };
    setMessages((prev) => [...prev, msg]);
    setNewMsg("");
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  };

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color={C.midGreen}>🍃 Breeze</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* チャネル切替 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {CHANNELS.map((ch) => (
          <button
            key={ch}
            onClick={() => setChannel(ch)}
            style={{
              padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
              background: channel === ch ? C.midGreen : "rgba(0,0,0,0.04)",
              color: channel === ch ? C.white : C.textSub,
              transition: "all 0.2s",
            }}
          >
            {ch}
          </button>
        ))}
      </div>

      {/* メッセージ一覧 */}
      <GlassPanel style={{ padding: 0, overflow: "hidden" }}>
        <div
          ref={scrollRef}
          style={{
            height: 400, overflowY: "auto", padding: 16,
            display: "flex", flexDirection: "column", gap: 8,
          }}
        >
          {messages.map((msg) => (
            <div key={msg.id} style={{
              padding: "8px 12px", borderRadius: 10,
              background: msg.isSystem ? "rgba(45,106,79,0.06)" : "transparent",
              borderLeft: msg.isSystem ? `3px solid ${C.midGreen}` : `3px solid ${roleColor(msg.role)}`,
            }}>
              {msg.isSystem ? (
                <div style={{ fontSize: 12, color: C.midGreen, fontWeight: 600 }}>
                  <span style={{ marginRight: 8 }}>🔔</span>{msg.text}
                  <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 8 }}>{msg.time}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.textDark }}>{msg.sender}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 6,
                      background: `${roleColor(msg.role)}15`, color: roleColor(msg.role),
                    }}>{msg.role}</span>
                    <span style={{ fontSize: 10, color: C.textMuted, marginLeft: "auto" }}>{msg.time}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.textDark, lineHeight: 1.6 }}>{msg.text}</div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* 入力フォーム */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 8 }}>
          <input
            type="text"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="メッセージを入力..."
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.08)", fontSize: 13,
              fontFamily: "'Noto Sans JP', sans-serif", outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            style={{
              padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700, fontFamily: "'Noto Sans JP', sans-serif",
              background: C.midGreen, color: C.white,
            }}
          >
            送信
          </button>
        </div>
      </GlassPanel>

      <div style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, background: "rgba(230,126,34,0.06)", textAlign: "center", fontSize: 11, color: "#e67e22" }}>
        ⚠ Breezeのメッセージは当日限り保持されます。翌日にはリセットされます。
      </div>

      <div style={{ marginTop: 8, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        チーム内リアルタイムチャット • チャネル別メッセージ • 業務連絡用
      </div>
    </div>
  );
}
