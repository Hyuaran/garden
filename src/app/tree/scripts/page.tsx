"use client";

/**
 * Garden-Tree スクリプト管理画面 (/tree/scripts)
 *
 * プロトタイプの <ScriptManageScreen /> を移植。
 *
 * 構成:
 *  1. 新規追加ボタン + 新規フォーム
 *  2. カテゴリ別アコーディオン（5カテゴリ）
 *  3. スクリプトカード（インライン編集・非表示・削除）
 *
 * - MANAGER専用画面
 * - カテゴリ: オープニング/ヒアリング/プレゼン/クロージング/アウト返し
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useState } from "react";

import { ActionButton } from "../_components/ActionButton";
import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";

/* ---------- 型定義 ---------- */

type Script = {
  id: number;
  title: string;
  category: string;
  content: string;
  visible: boolean;
};

/* ---------- デモデータ ---------- */

const CATEGORIES = ["オープニング", "ヒアリング", "プレゼン", "クロージング", "アウト返し"];

const INITIAL_SCRIPTS: Script[] = [
  { id: 1, title: "標準オープニング", category: "オープニング", content: "お忙しいところ恐れ入ります。Gardenグループの○○と申します。本日は電気料金のお見直しについてご案内でお電話いたしました。", visible: true },
  { id: 2, title: "ヒアリング基本", category: "ヒアリング", content: "現在のご契約プランをお聞きしてもよろしいでしょうか？月々のお支払い額はおいくらくらいでしょうか？", visible: true },
  { id: 3, title: "料金比較プレゼン", category: "プレゼン", content: "お客様の現在のプランと比較しますと、年間で約○万円のお得になる見込みです。", visible: true },
  { id: 4, title: "クロージング基本", category: "クロージング", content: "本日お手続きいただければ、来月分からの適用が可能です。お手続き、進めてもよろしいでしょうか？", visible: true },
  { id: 5, title: "断り対応（忙しい）", category: "アウト返し", content: "お忙しいところ大変失礼いたしました。もしよろしければ、お時間のある時にご説明させていただければと思いますが、いかがでしょうか？", visible: true },
];

/* ---------- コンポーネント ---------- */

export default function ScriptManagePage() {
  const [scripts, setScripts] = useState<Script[]>(INITIAL_SCRIPTS);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCat, setEditCat] = useState("");
  const [editContent, setEditContent] = useState("");
  const [newMode, setNewMode] = useState(false);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  const toggleCat = (cat: string) => setOpenCats((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const startEdit = (s: Script) => {
    setEditId(s.id);
    setEditTitle(s.title);
    setEditCat(s.category);
    setEditContent(s.content);
  };

  const saveEdit = () => {
    setScripts((prev) => prev.map((s) =>
      s.id === editId ? { ...s, title: editTitle, category: editCat, content: editContent } : s
    ));
    setEditId(null);
  };

  const addNew = () => {
    const newScript: Script = {
      id: Date.now(),
      title: editTitle || "新しいスクリプト",
      category: editCat || CATEGORIES[0],
      content: editContent || "",
      visible: true,
    };
    setScripts((prev) => [...prev, newScript]);
    setNewMode(false);
    setEditTitle(""); setEditCat(""); setEditContent("");
  };

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.1)", fontSize: 13,
    fontFamily: "'Noto Sans JP', sans-serif", outline: "none",
    marginBottom: 8,
  };

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#8b5cf6">📜 スクリプト管理</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* タイトル + 新規追加 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>スクリプト一覧</div>
        <ActionButton
          label={newMode ? "キャンセル" : "＋ 新規追加"}
          color={newMode ? "rgba(0,0,0,0.06)" : "#8b5cf6"}
          textColor={newMode ? C.textSub : C.white}
          onClick={() => { setNewMode(!newMode); setEditTitle(""); setEditCat(""); setEditContent(""); }}
        />
      </div>

      {/* 新規フォーム */}
      {newMode && (
        <GlassPanel style={{ padding: 16, marginBottom: 16, borderLeft: "4px solid #8b5cf6" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>新規スクリプト</div>
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="タイトル" style={inputSt} />
          <select value={editCat} onChange={(e) => setEditCat(e.target.value)} style={{ ...inputSt, cursor: "pointer" }}>
            <option value="">カテゴリを選択</option>
            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="スクリプト本文..." style={{ ...inputSt, minHeight: 80, resize: "vertical" }} />
          <ActionButton label="追加する" color="#8b5cf6" onClick={addNew} />
        </GlassPanel>
      )}

      {/* カテゴリ別アコーディオン */}
      {CATEGORIES.map((cat) => {
        const catScripts = scripts.filter((s) => s.category === cat);
        const isOpen = openCats[cat] !== false; // デフォルトopen
        return (
          <GlassPanel key={cat} style={{ padding: 0, marginBottom: 12, overflow: "hidden" }}>
            <div
              onClick={() => toggleCat(cat)}
              style={{
                padding: "12px 16px", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "rgba(139,92,246,0.04)",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>{cat}（{catScripts.length}件）</span>
              <span style={{ fontSize: 16, color: C.textMuted }}>{isOpen ? "−" : "＋"}</span>
            </div>
            {isOpen && catScripts.map((s) => (
              <div key={s.id} style={{
                padding: "12px 16px", borderTop: "1px solid rgba(0,0,0,0.04)",
                opacity: s.visible ? 1 : 0.4,
              }}>
                {editId === s.id ? (
                  /* 編集モード */
                  <div>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={inputSt} />
                    <select value={editCat} onChange={(e) => setEditCat(e.target.value)} style={{ ...inputSt, cursor: "pointer" }}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ ...inputSt, minHeight: 60, resize: "vertical" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <ActionButton label="保存" color={C.midGreen} onClick={saveEdit} />
                      <ActionButton label="キャンセル" color="rgba(0,0,0,0.06)" textColor={C.textSub} onClick={() => setEditId(null)} />
                    </div>
                  </div>
                ) : (
                  /* 表示モード */
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.textDark }}>{s.title}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => startEdit(s)} style={{ fontSize: 11, color: "#3478c6", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif" }}>編集</button>
                        <button onClick={() => setScripts((prev) => prev.map((sc) => sc.id === s.id ? { ...sc, visible: !sc.visible } : sc))} style={{ fontSize: 11, color: "#e67e22", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif" }}>{s.visible ? "非表示" : "表示"}</button>
                        <button onClick={() => setScripts((prev) => prev.filter((sc) => sc.id !== s.id))} style={{ fontSize: 11, color: C.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif" }}>削除</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, background: "rgba(0,0,0,0.02)", padding: "8px 12px", borderRadius: 8 }}>
                      {s.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isOpen && catScripts.length === 0 && (
              <div style={{ padding: "16px", textAlign: "center", fontSize: 12, color: C.textMuted }}>
                このカテゴリにはスクリプトがありません
              </div>
            )}
          </GlassPanel>
        );
      })}

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        責任者専用 • カテゴリ別にスクリプトを管理 • 非表示にしたスクリプトはメンバーに表示されません
      </div>
    </div>
  );
}
