"use client";

/**
 * Garden-Tree フィードバック入力画面 (/tree/feedback)
 *
 * プロトタイプの <FeedbackScreen /> を移植。
 *
 * 構成:
 *  1. メンバー選択リスト（左パネル）
 *  2. フィードバック入力フォーム（右パネル）
 *     - ラフ入力 → 敬語変換 → プレビュー → 保存
 *
 * - MANAGER専用画面
 * - Claude API で敬語変換（デモではregex置換）
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useState } from "react";

import { ActionButton } from "../_components/ActionButton";
import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";

/* ---------- 型定義 ---------- */

type MemberItem = {
  id: string;
  name: string;
  dept: string;
};

type SavedFeedback = {
  text: string;
  date: string;
};

/* ---------- デモデータ ---------- */

const MEMBERS: MemberItem[] = [
  { id: "m1", name: "小泉 翔", dept: "社員" },
  { id: "m2", name: "萩尾 拓也", dept: "関電" },
  { id: "m3", name: "信田 優希", dept: "テレマ" },
  { id: "m4", name: "林 佳音", dept: "テレマ" },
  { id: "m5", name: "石原 孝志朗", dept: "社員" },
  { id: "m6", name: "辻 舞由子", dept: "社員" },
  { id: "m7", name: "南薗 優樹", dept: "テレマ" },
  { id: "m8", name: "桐井 大輔", dept: "関電" },
  { id: "m9", name: "宮永 ひかり", dept: "社員" },
  { id: "m10", name: "田中 実花", dept: "テレマ" },
];

/* ---------- ヘルパー ---------- */

function fmtDate(): string {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** デモ用の敬語変換（本番はClaude API） */
function demoConvert(raw: string): string {
  return raw
    .replace(/すげー/g, "素晴らしい")
    .replace(/めっちゃ/g, "非常に")
    .replace(/やばい/g, "驚くべき")
    .replace(/がんばって/g, "引き続き努力してください")
    .replace(/いい感じ/g, "良い傾向です")
    .replace(/ダメ/g, "改善の余地があります")
    .replace(/もっと/g, "さらに")
    .replace(/ちゃんと/g, "しっかりと");
}

/* ---------- コンポーネント ---------- */

export default function FeedbackPage() {
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [convertedText, setConvertedText] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [savedFeedbacks, setSavedFeedbacks] = useState<Record<string, SavedFeedback>>({
    m1: { text: "本日の架電対応、非常に丁寧で素晴らしかったです。お客様への傾聴姿勢が良く、成約率向上につながっています。", date: "4/15 14:30" },
    m9: { text: "トークスクリプトの習熟度が上がってきています。引き続き努力してください。", date: "4/15 15:00" },
  });

  const handleConvert = () => {
    setIsConverting(true);
    setTimeout(() => {
      setConvertedText(demoConvert(rawInput));
      setIsConverting(false);
    }, 800);
  };

  const handleSave = () => {
    if (!selectedMember || !convertedText) return;
    const isNew = !savedFeedbacks[selectedMember.id];
    setSavedFeedbacks((prev) => ({
      ...prev,
      [selectedMember.id]: { text: convertedText, date: fmtDate() },
    }));
    setRawInput("");
    setConvertedText("");
    // fbRemaining は TreeState で管理（将来接続）
    void isNew;
  };

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#e67e22">📝 フィードバック入力</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
        {/* 左パネル: メンバーリスト */}
        <GlassPanel style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 12 }}>メンバー一覧</div>
          {MEMBERS.map((m) => {
            const hasFb = !!savedFeedbacks[m.id];
            const isSelected = selectedMember?.id === m.id;
            return (
              <div
                key={m.id}
                onClick={() => { setSelectedMember(m); setRawInput(""); setConvertedText(""); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 4,
                  background: isSelected ? "rgba(52,120,198,0.1)" : "transparent",
                  borderLeft: isSelected ? "3px solid #3478c6" : "3px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{m.dept}</div>
                </div>
                {hasFb && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: C.midGreen, fontWeight: 600 }}>✓ 入力済</div>
                    <div style={{ fontSize: 9, color: C.textMuted }}>{savedFeedbacks[m.id].date}</div>
                  </div>
                )}
              </div>
            );
          })}
        </GlassPanel>

        {/* 右パネル: 入力フォーム */}
        <div>
          {!selectedMember ? (
            <GlassPanel style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👈</div>
              <div style={{ fontSize: 14, color: C.textMuted }}>左のリストからメンバーを選択してください</div>
            </GlassPanel>
          ) : (
            <>
              <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>{selectedMember.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{selectedMember.dept}</div>
              </GlassPanel>

              {/* 既存フィードバック表示 */}
              {savedFeedbacks[selectedMember.id] && (
                <GlassPanel style={{ padding: 16, marginBottom: 16, borderLeft: `4px solid ${C.midGreen}` }}>
                  <div style={{ fontSize: 11, color: C.midGreen, fontWeight: 600, marginBottom: 6 }}>現在のフィードバック（{savedFeedbacks[selectedMember.id].date}）</div>
                  <div style={{ fontSize: 13, color: C.textDark, lineHeight: 1.8 }}>{savedFeedbacks[selectedMember.id].text}</div>
                </GlassPanel>
              )}

              {/* ラフ入力 */}
              <GlassPanel style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>ラフ入力（口語OK）</div>
                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder="例: 今日のトークめっちゃいい感じだった。がんばってほしい"
                  style={{
                    width: "100%", minHeight: 80, padding: 12, borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.08)", fontSize: 13,
                    fontFamily: "'Noto Sans JP', sans-serif", resize: "vertical",
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <ActionButton
                    label={isConverting ? "変換中..." : "敬語に変換する"}
                    color="#3478c6"
                    onClick={handleConvert}
                    disabled={!rawInput || isConverting}
                  />
                </div>
              </GlassPanel>

              {/* 変換結果プレビュー */}
              {convertedText && (
                <GlassPanel style={{ padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>変換結果（編集可能）</div>
                  <textarea
                    value={convertedText}
                    onChange={(e) => setConvertedText(e.target.value)}
                    style={{
                      width: "100%", minHeight: 80, padding: 12, borderRadius: 10,
                      border: "1px solid rgba(45,106,79,0.2)", fontSize: 13,
                      fontFamily: "'Noto Sans JP', sans-serif", resize: "vertical",
                      background: "rgba(45,106,79,0.03)", outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <ActionButton
                      label="保存する"
                      color={C.midGreen}
                      onClick={handleSave}
                    />
                  </div>
                </GlassPanel>
              )}
            </>
          )}

          {/* FB一覧リンク */}
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <span style={{ fontSize: 12, color: "#3478c6", cursor: "pointer", fontWeight: 600 }}>
              📋 フィードバック一覧を見る →
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        責任者専用 • ラフな表現を敬語に自動変換 • 保存後にメンバーへ通知
      </div>
    </div>
  );
}
