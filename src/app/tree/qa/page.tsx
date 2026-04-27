"use client";

/**
 * Garden-Tree Q&A検索画面 (/tree/qa)
 *
 * プロトタイプの <QASearchScreen /> を移植。
 *
 * 構成:
 *  1. Q&A登録ボタン + 登録モーダル
 *  2. 検索窓（キーワード全文検索）
 *  3. カテゴリフィルター（営業テクニック / 商品知識 / 対応マニュアル / 社内ルール）
 *  4. お気に入りフィルター（localStorage 永続化）
 *  5. Q&Aアコーディオンリスト
 *     - 権限別回答: トス向け / クローザー向け / 両方
 *     - 責任者: 両方表示 + インライン編集
 *     - 対応マニュアル: 責任者のみアクセス可
 *
 * - サイドバー・KPIヘッダーは TreeShell が描画するため、本ページは中身のみ。
 */

import { useEffect, useState } from "react";

import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { ROLES } from "../_constants/roles";
import { useTreeState } from "../_state/TreeStateContext";

type QAItem = {
  q: string;
  aToss: string;
  aCloser: string;
  tag: string;
  audience: "both" | "toss" | "closer";
};

const INITIAL_QA: QAItem[] = [
  { q: "アポイント時の最適なクロージングは？", aToss: "提案型で「では○○の日時でいかがでしょうか？」と具体的に打診してください。", aCloser: "お客様の状況を確認し「本日中のお手続きで特別割引が適用されます」と具体的メリットを提示してください。", tag: "営業テクニック", audience: "both" },
  { q: "光コラボの転用手続きの流れは？", aToss: "転用承諾番号をNTTから取得→申込書記入→工事日調整の3ステップです。", aCloser: "転用承諾番号を確認→申込書の記入サポート→工事日調整→お客様へ完了連絡。重要確認事項も忘れずに。", tag: "商品知識", audience: "both" },
  { q: "クレーム対応の基本フローは？", aToss: "まず傾聴→謝罪→事実確認→解決策提示。上長相談が必要な場合は折り返し。", aCloser: "まず傾聴→謝罪→事実確認→解決策提示。上長相談が必要な場合は折り返し。", tag: "対応マニュアル", audience: "both" },
  { q: "フレッツ光の提供エリア確認方法は？", aToss: "NTT東日本/西日本の提供判定サイトで検索できます。", aCloser: "NTT東日本/西日本の提供判定サイトで検索。判定不可の場合はNTTに直接問い合わせてください。", tag: "商品知識", audience: "both" },
  { q: "再コールの最適なタイミングは？", aToss: "曜日・時間帯を変えて3回までが目安です。", aCloser: "曜日・時間帯を変えて3回まで。前回の反応メモを確認してからコールしましょう。", tag: "営業テクニック", audience: "both" },
  { q: "トスのコツ — 第一声の印象づくり", aToss: "最初の7秒で興味を引くことが重要。「○○様のエリアで特別なご案内が…」と具体性を出す。", aCloser: "", tag: "営業テクニック", audience: "toss" },
  { q: "クロージング時の料金説明テクニック", aToss: "", aCloser: "月額の比較表を使い「現在より○○円安くなります」と具体的な差額を伝える。", tag: "営業テクニック", audience: "closer" },
];

const ALL_CATS = ["すべて", "営業テクニック", "商品知識", "対応マニュアル", "社内ルール"];

export default function QASearchPage() {
  const { role } = useTreeState();

  // --- 検索・フィルタ ---
  const [sq, setSq] = useState("");
  const [sc, setSc] = useState("すべて");
  const [ex, setEx] = useState<Record<number, boolean>>({});
  const [ei, setEi] = useState<number | null>(null);
  const [showFavOnly, setShowFavOnly] = useState(false);

  // --- お気に入り（localStorage 永続化） ---
  const [favs, setFavs] = useState<number[]>([]);
  useEffect(() => {
    try {
      const s = localStorage.getItem("gl_qa_favs");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s) setFavs(JSON.parse(s));
    } catch { /* ignore */ }
  }, []);
  const toggleFav = (qIdx: number) => {
    setFavs((prev) => {
      const next = prev.includes(qIdx)
        ? prev.filter((i) => i !== qIdx)
        : [...prev, qIdx];
      try { localStorage.setItem("gl_qa_favs", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // --- Q&A データ ---
  const [qa, setQa] = useState<QAItem[]>(INITIAL_QA);

  // --- 登録モーダル ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newAToss, setNewAToss] = useState("");
  const [newACloser, setNewACloser] = useState("");
  const [newTag, setNewTag] = useState("営業テクニック");

  // --- 権限別フィルタ ---
  const hasManualAccess = role === ROLES.MANAGER;
  const cats = hasManualAccess ? ALL_CATS : ALL_CATS.filter((c) => c !== "対応マニュアル");
  const isS = sq.trim().length > 0;

  const audienceFilter = (item: QAItem) => {
    if (role === ROLES.MANAGER) return true;
    if (role === ROLES.SPROUT) return item.audience === "both" || item.audience === "toss";
    return item.audience === "both" || item.audience === "closer";
  };

  const fl = qa.filter((it, ri) =>
    audienceFilter(it) &&
    (sc === "すべて" || it.tag === sc) &&
    (!isS || it.q.includes(sq) || it.aToss.includes(sq) || it.aCloser.includes(sq) || it.tag.includes(sq)) &&
    (hasManualAccess || it.tag !== "対応マニュアル") &&
    (!showFavOnly || favs.includes(ri))
  );

  const getAnswer = (item: QAItem) => {
    if (role === ROLES.MANAGER) return null;
    if (role === ROLES.SPROUT) return item.aToss || "";
    return item.aCloser || "";
  };

  const handleSubmitNew = () => {
    if (newQ.trim() && (newAToss.trim() || newACloser.trim())) {
      const audience: QAItem["audience"] =
        newAToss.trim() && newACloser.trim() ? "both" : newAToss.trim() ? "toss" : "closer";
      setQa((prev) => [...prev, { q: newQ.trim(), aToss: newAToss.trim(), aCloser: newACloser.trim(), tag: newTag, audience }]);
      setNewQ(""); setNewAToss(""); setNewACloser(""); setNewTag("営業テクニック");
      setShowAddModal(false);
    }
  };
  const canSubmit = newQ.trim() && (newAToss.trim() || newACloser.trim());

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 800, margin: "0 auto" }}>
      {/* ワイヤーフレームラベル */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#6a5a8a">画面8: Q&A検索</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* 登録ボタン */}
      <div
        onClick={() => setShowAddModal(true)}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(45,106,79,0.04)"; e.currentTarget.style.borderColor = C.darkGreen; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = C.midGreen; }}
        style={{
          marginBottom: 12, padding: "14px 20px", border: `1px dashed ${C.midGreen}`, borderRadius: 14,
          textAlign: "center", color: C.midGreen, fontSize: 14, fontWeight: 700, cursor: "pointer",
          fontFamily: "'Noto Sans JP', sans-serif", transition: "all 0.15s ease",
        }}
      >＋ 新しいQ&Aを登録する</div>

      {/* 検索窓 */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: C.white, borderRadius: 14, border: "2px solid #dcedc8" }}>
          <span style={{ fontSize: 20 }}>🔍</span>
          <input
            type="text" placeholder="疑問検索窓（例：転用手続き と入力）" value={sq}
            onChange={(e) => setSq(e.target.value)}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "'Noto Sans JP', sans-serif", color: C.textDark }}
          />
          {sq && (
            <button onClick={() => setSq("")} style={{ border: "none", background: "#eee", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 12, color: "#888" }}>✕</button>
          )}
        </div>
      </GlassPanel>

      {/* カテゴリ + お気に入りフィルタ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {cats.map((cat) => (
          <button key={cat} onClick={() => setSc(cat)} style={{
            padding: "6px 16px", borderRadius: 20,
            border: sc === cat ? `2px solid ${C.midGreen}` : "1px solid #ddd",
            background: sc === cat ? "rgba(45,106,79,0.06)" : C.white,
            color: sc === cat ? C.darkGreen : C.textMuted,
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif",
          }}>{cat}</button>
        ))}
        <div style={{ width: 1, height: 20, background: "#ddd", margin: "0 4px" }} />
        <button onClick={() => setShowFavOnly((p) => !p)} style={{
          padding: "6px 16px", borderRadius: 20,
          border: showFavOnly ? `2px solid ${C.gold}` : "1px solid #ddd",
          background: showFavOnly ? "rgba(201,168,76,0.1)" : C.white,
          color: showFavOnly ? C.goldDark : C.textMuted,
          fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif",
        }}>⭐ お気に入りのみ</button>
      </div>

      {/* 権限別対象表示 */}
      {role !== ROLES.MANAGER && (
        <div style={{
          marginBottom: 16, padding: "8px 14px", borderRadius: 10,
          background: role === ROLES.SPROUT ? "rgba(45,106,79,0.04)" : "rgba(59,130,246,0.04)",
          border: `1px solid ${role === ROLES.SPROUT ? "rgba(45,106,79,0.15)" : "rgba(59,130,246,0.15)"}`,
          fontSize: 11, color: C.textMuted,
        }}>
          📋 {role === ROLES.SPROUT ? "トス向け" : "クローザー向け"}のQ&Aを表示中（{fl.length}件）
        </div>
      )}

      {/* Q&Aリスト */}
      {fl.map((item) => {
        const ri = qa.indexOf(item);
        const isO = isS || !!ex[ri];
        const isFav = favs.includes(ri);
        return (
          <GlassPanel key={ri} style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
            <button
              onClick={() => setEx((p) => ({ ...p, [ri]: !p[ri] }))}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                width: "100%", padding: "16px 20px", border: "none", background: "transparent",
                cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                <span
                  onClick={(e) => { e.stopPropagation(); toggleFav(ri); }}
                  style={{ fontSize: 18, cursor: "pointer", transition: "transform 0.15s", transform: isFav ? "scale(1.2)" : "scale(1)", width: 24, textAlign: "center", flexShrink: 0 }}
                >{isFav ? "⭐" : "☆"}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.darkGreen }}>Q: {item.q}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {item.audience === "toss" && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: "rgba(45,106,79,0.08)", color: C.midGreen, fontWeight: 600 }}>トス向け</span>}
                {item.audience === "closer" && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: "rgba(59,130,246,0.08)", color: "#3b82f6", fontWeight: 600 }}>クローザー向け</span>}
                {item.audience === "both" && role === ROLES.MANAGER && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: "rgba(156,163,175,0.08)", color: "#6b7280", fontWeight: 600 }}>全員</span>}
                <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: "rgba(45,106,79,0.08)", color: C.midGreen, fontWeight: 600 }}>{item.tag}</span>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6,
                  background: isO ? "rgba(214,48,49,0.06)" : "rgba(45,106,79,0.06)",
                  color: isO ? C.red : C.midGreen, fontSize: 16, fontWeight: 800,
                }}>{isO ? "−" : "＋"}</span>
              </div>
            </button>
            {isO && (
              <div style={{ padding: "0 20px 16px 46px", fontSize: 13, color: C.textSub, lineHeight: 1.8, borderTop: "1px solid rgba(0,0,0,0.04)", animation: "fadeIn 0.2s ease" }}>
                <div style={{ paddingTop: 12 }}>
                  {role === ROLES.MANAGER ? (
                    ei === ri ? (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.midGreen, marginBottom: 4 }}>トス向け回答</div>
                        <textarea defaultValue={item.aToss} rows={2} style={{ width: "100%", padding: 10, border: "1px solid #dcedc8", borderRadius: 8, fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", boxSizing: "border-box", marginBottom: 8 }}
                          onBlur={(e) => { const n = [...qa]; n[ri] = { ...n[ri], aToss: e.target.value }; setQa(n); }} autoFocus />
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", marginBottom: 4 }}>クローザー向け回答</div>
                        <textarea defaultValue={item.aCloser} rows={2} style={{ width: "100%", padding: 10, border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", boxSizing: "border-box" }}
                          onBlur={(e) => { const n = [...qa]; n[ri] = { ...n[ri], aCloser: e.target.value }; setQa(n); setEi(null); }} />
                        <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>入力欄外をクリックで保存</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            {(item.audience === "both" || item.audience === "toss") && item.aToss && (
                              <div style={{ marginBottom: 6 }}>
                                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "rgba(45,106,79,0.08)", color: C.midGreen, fontWeight: 600, marginRight: 6 }}>トス</span>
                                <span>A: {item.aToss}</span>
                              </div>
                            )}
                            {(item.audience === "both" || item.audience === "closer") && item.aCloser && (
                              <div>
                                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "rgba(59,130,246,0.08)", color: "#3b82f6", fontWeight: 600, marginRight: 6 }}>クローザー</span>
                                <span>A: {item.aCloser}</span>
                              </div>
                            )}
                          </div>
                          <button onClick={() => setEi(ri)} style={{
                            border: "none", background: "rgba(214,48,49,0.05)", color: C.red,
                            padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                            cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", marginLeft: 12, flexShrink: 0,
                          }}>✏️ 編集</button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span>A: {getAnswer(item)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </GlassPanel>
        );
      })}
      {fl.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#aaa", fontSize: 14 }}>該当するQ&Aが見つかりませんでした</div>
      )}

      {/* Q&A登録モーダル */}
      {showAddModal && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            background: C.white, borderRadius: 20, padding: "32px 36px", width: 480,
            maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            fontFamily: "'Noto Sans JP', sans-serif",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: C.darkGreen, margin: 0 }}>新しいQ&Aを登録</h2>
                <p style={{ fontSize: 12, color: C.textMuted, margin: "4px 0 0" }}>質問と回答を入力してください</p>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{
                border: "none", background: "rgba(0,0,0,0.05)", borderRadius: "50%",
                width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#888",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>✕</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6, fontWeight: 600 }}>カテゴリ</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ALL_CATS.filter((c) => c !== "すべて").map((cat) => (
                  <button key={cat} onClick={() => setNewTag(cat)} style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: newTag === cat ? `2px solid ${C.midGreen}` : "1px solid #ddd",
                    background: newTag === cat ? "rgba(45,106,79,0.06)" : C.white,
                    color: newTag === cat ? C.darkGreen : C.textMuted, fontFamily: "'Noto Sans JP', sans-serif",
                  }}>{cat}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6, fontWeight: 600 }}>質問</div>
              <input type="text" placeholder="例：転用手続きの流れは？" value={newQ} onChange={(e) => setNewQ(e.target.value)}
                style={{ width: "100%", padding: "12px 14px", border: "1px solid #dcedc8", borderRadius: 12, fontSize: 14, boxSizing: "border-box", fontFamily: "'Noto Sans JP', sans-serif", background: C.white }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6, fontWeight: 600 }}>トス向け回答</div>
              <textarea placeholder="トス向けの回答内容を入力" rows={3} value={newAToss} onChange={(e) => setNewAToss(e.target.value)}
                style={{ width: "100%", padding: "12px 14px", border: "1px solid #dcedc8", borderRadius: 12, fontSize: 14, boxSizing: "border-box", resize: "vertical", fontFamily: "'Noto Sans JP', sans-serif", background: C.white }} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6, fontWeight: 600 }}>クローザー向け回答</div>
              <textarea placeholder="クローザー向けの回答内容を入力" rows={3} value={newACloser} onChange={(e) => setNewACloser(e.target.value)}
                style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 12, fontSize: 14, boxSizing: "border-box", resize: "vertical", fontFamily: "'Noto Sans JP', sans-serif", background: C.white }} />
              <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>※ どちらか一方のみでもOK。両方入力すると全員向けになります。</div>
            </div>

            <button onClick={handleSubmitNew} style={{
              width: "100%", padding: "14px", border: "none", borderRadius: 14,
              background: canSubmit ? `linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})` : "#ccc",
              color: C.white, fontSize: 16, fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "'Noto Sans JP', sans-serif",
              boxShadow: canSubmit ? `0 4px 16px ${C.midGreen}33` : "none", transition: "all 0.2s ease",
            }}>登録する</button>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}
