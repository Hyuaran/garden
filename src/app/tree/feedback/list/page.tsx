"use client";

/**
 * Garden-Tree フィードバック一覧画面 (/tree/feedback/list)
 *
 * プロトタイプの <FeedbackListScreen /> を移植。
 *
 * 構成:
 *  1. 検索バー
 *  2. フィードバックカード一覧（いいね機能付き）
 *  3. MANAGER: 名前表示ON/OFFトグル
 *
 * - 非MANAGERは自分宛のフィードバックのみ表示
 * - MANAGERは全件表示 + 名前表示切替
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useState } from "react";

import { GlassPanel } from "../../_components/GlassPanel";
import { WireframeLabel } from "../../_components/WireframeLabel";
import { C } from "../../_constants/colors";
import { ROLES } from "../../_constants/roles";
import { USER } from "../../_constants/user";
import { useTreeState } from "../../_state/TreeStateContext";

/* ---------- 型定義 ---------- */

type FeedbackEntry = {
  id: string;
  member: string;
  text: string;
  date: string;
  author: string;
  likes: number;
};

/* ---------- デモデータ ---------- */

const ALL_FEEDBACKS: FeedbackEntry[] = [
  { id: "fb1", member: "小泉 翔", text: "本日の架電対応、非常に丁寧で素晴らしかったです。お客様への傾聴姿勢が良く、成約率向上につながっています。", date: "4/15", author: "東海林 美琴", likes: 3 },
  { id: "fb2", member: "萩尾 拓也", text: "クロージングの精度が上がっています。特に反論処理のパターンが増えており、安定した成果につながっています。", date: "4/15", author: "東海林 美琴", likes: 5 },
  { id: "fb3", member: "信田 優希", text: "トスの品質が非常に高いです。ヒアリング項目の漏れがなく、クローザーへの引き継ぎがスムーズです。", date: "4/14", author: "東海林 美琴", likes: 2 },
  { id: "fb4", member: "林 佳音", text: "架電数は少なめですが、接続率・有効率ともに高水準です。質の高いコールを維持してください。", date: "4/14", author: "東海林 美琴", likes: 4 },
  { id: "fb5", member: "東海林 美琴", text: "チーム全体のマネジメントが行き届いています。メンバーへの声掛けも適切です。", date: "4/13", author: "本部", likes: 7 },
  { id: "fb6", member: "宮永 ひかり", text: "トークスクリプトの習熟度が上がってきています。引き続き努力してください。", date: "4/13", author: "東海林 美琴", likes: 1 },
];

/* ---------- コンポーネント ---------- */

export default function FeedbackListPage() {
  const { role, treeUser } = useTreeState();
  const [searchTerm, setSearchTerm] = useState("");
  const [likeState, setLikeState] = useState<Record<string, boolean>>({});
  const [showNames, setShowNames] = useState(true);

  const selfName = treeUser?.name ?? USER.fullName;

  // 絞り込み
  const filtered = (() => {
    let list = ALL_FEEDBACKS;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((fb) =>
        fb.member.toLowerCase().includes(q) ||
        fb.text.toLowerCase().includes(q) ||
        fb.author.toLowerCase().includes(q)
      );
    } else if (role !== ROLES.MANAGER) {
      list = list.filter((fb) => fb.member === selfName);
    }
    return list;
  })();

  const toggleLike = (id: string) => {
    setLikeState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#e67e22">📋 フィードバック一覧</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* 検索バー + コントロール */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: C.textMuted }}>🔍</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="メンバー名・内容で検索..."
            style={{
              width: "100%", padding: "10px 12px 10px 38px", borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.08)", fontSize: 13,
              fontFamily: "'Noto Sans JP', sans-serif", outline: "none",
            }}
          />
        </div>
        {role === ROLES.MANAGER && (
          <button
            onClick={() => setShowNames(!showNames)}
            style={{
              padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
              background: showNames ? C.midGreen : "rgba(0,0,0,0.06)",
              color: showNames ? C.white : C.textSub,
            }}
          >
            名前表示 {showNames ? "ON" : "OFF"}
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
        {filtered.length}件のフィードバック
      </div>

      {/* フィードバックカード */}
      {filtered.length === 0 ? (
        <GlassPanel style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 14, color: C.textMuted }}>該当するフィードバックがありません</div>
        </GlassPanel>
      ) : (
        filtered.map((fb) => {
          const liked = likeState[fb.id] || false;
          const likeCount = fb.likes + (liked ? 1 : 0);
          return (
            <GlassPanel key={fb.id} style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>
                    {showNames ? fb.member : "メンバー"}
                  </span>
                  <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>{fb.date}</span>
                </div>
                <span style={{ fontSize: 11, color: C.textMuted }}>{fb.author}</span>
              </div>
              <div style={{
                fontSize: 13, color: C.textDark, lineHeight: 1.8, padding: "8px 12px",
                borderLeft: `3px solid ${C.midGreen}`, background: "rgba(45,106,79,0.03)",
                borderRadius: "0 8px 8px 0",
              }}>
                {fb.text}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  onClick={() => toggleLike(fb.id)}
                  style={{
                    padding: "4px 12px", borderRadius: 16, border: "none", cursor: "pointer",
                    fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif",
                    background: liked ? "rgba(231,76,60,0.1)" : "rgba(0,0,0,0.03)",
                    color: liked ? "#e74c3c" : C.textMuted,
                    transition: "all 0.2s",
                  }}
                >
                  {liked ? "❤️" : "🤍"} {likeCount}
                </button>
              </div>
            </GlassPanel>
          );
        })
      )}

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        {role === ROLES.MANAGER ? "全メンバーのフィードバックを表示" : "自分宛てのフィードバックを表示"} • いいね機能で感謝を共有
      </div>
    </div>
  );
}
