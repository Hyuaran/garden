"use client";

/**
 * Garden モバイル — 経費申請（撮影〜選択〜送信）
 * Phase 2 第1版：枠カメラ（スマホ純正カメラ）で連続撮影 → 選択（全選択/全解除・失敗は選択不可）→ 送信。
 * ※撮影は <input type=file capture> 方式（全機種で確実・高画質）。ライブ枠プレビューは後続で強化。
 * ※送信の実保存(DB/Storage)とOCRは後続フェーズで接続（本版は撮影〜選択UXと送信導線まで）。
 */

import { useRef, useState } from "react";
import Link from "next/link";

type Shot = {
  id: string;
  url: string;
  selected: boolean;
  failed: boolean;
};

const MAX_SHOTS = 50;

export default function MobileExpenseSubmit() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Shot[] = [];
    for (const file of Array.from(files)) {
      if (shots.length + next.length >= MAX_SHOTS) break;
      seq.current += 1;
      next.push({
        id: `s${seq.current}`,
        url: URL.createObjectURL(file),
        selected: true,
        failed: false,
      });
    }
    setShots((prev) => [...prev, ...next]);
    setSent(false);
  };

  const toggle = (id: string) =>
    setShots((prev) =>
      prev.map((s) => (s.id === id && !s.failed ? { ...s, selected: !s.selected } : s)),
    );

  const markFailed = (id: string) =>
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, failed: true, selected: false } : s)));

  const selectableCount = shots.filter((s) => !s.failed).length;
  const selectedCount = shots.filter((s) => s.selected && !s.failed).length;

  const setAll = (val: boolean) =>
    setShots((prev) => prev.map((s) => (s.failed ? s : { ...s, selected: val })));

  const submit = () => {
    if (selectedCount === 0) return;
    // TODO(Phase2-後続): bud_expense_requests へ INSERT ＋ 画像を Storage/Drive へアップロード。
    setSent(true);
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#f7f4ec",
        padding: "16px 14px 120px",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Link href="/m/bud" style={{ textDecoration: "none", color: "#7b745f", fontSize: 22, lineHeight: 1 }} aria-label="戻る">
          ‹
        </Link>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#3d3528" }}>経費申請 — レシート撮影</div>
      </header>

      {/* 撮影ボタン */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={shots.length >= MAX_SHOTS}
        style={{
          width: "100%",
          padding: "16px",
          fontSize: 16,
          fontWeight: 700,
          color: "#fff",
          background: shots.length >= MAX_SHOTS ? "#bbb" : "#E07A9B",
          border: "none",
          borderRadius: 14,
          boxShadow: "0 3px 10px rgba(224,122,155,0.3)",
        }}
      >
        📸 レシートを撮る（連続OK・最大{MAX_SHOTS}枚）
      </button>

      {shots.length > 0 && (
        <>
          {/* 選択操作バー */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 10px" }}>
            <span style={{ fontSize: 13, color: "#6d6356", flex: 1 }}>
              {shots.length}枚（選択 {selectedCount} / {selectableCount}）
            </span>
            <button type="button" onClick={() => setAll(true)} style={chip}>全選択</button>
            <button type="button" onClick={() => setAll(false)} style={chip}>全解除</button>
          </div>

          {/* サムネイルグリッド */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {shots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={s.selected}
                style={{
                  position: "relative",
                  padding: 0,
                  border: s.failed
                    ? "2px solid #c0392b"
                    : s.selected
                    ? "3px solid #E07A9B"
                    : "2px solid #d8d4c8",
                  borderRadius: 10,
                  overflow: "hidden",
                  aspectRatio: "1 / 1",
                  background: "#eee",
                  opacity: s.failed ? 0.5 : 1,
                }}
              >
                <img
                  src={s.url}
                  alt=""
                  onError={() => markFailed(s.id)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                {s.selected && !s.failed && (
                  <span style={badge("#E07A9B")}>✓</span>
                )}
                {s.failed && <span style={{ ...badge("#c0392b"), borderRadius: 0, inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>失敗</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 送信バー（下部固定） */}
      {shots.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "12px 14px calc(12px + env(safe-area-inset-bottom))",
            background: "rgba(247,244,236,0.96)",
            borderTop: "1px solid #e2ddcf",
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          {sent ? (
            <div style={{ textAlign: "center", color: "#5e7d44", fontWeight: 700, padding: 8 }}>
              ✓ {selectedCount}件を送信しました（テスト）
            </div>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={selectedCount === 0}
              style={{
                width: "100%",
                padding: 15,
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                background: selectedCount === 0 ? "#bbb" : "#5e7d44",
                border: "none",
                borderRadius: 14,
              }}
            >
              選択した {selectedCount} 件を送信
            </button>
          )}
        </div>
      )}
    </main>
  );
}

const chip: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #cdbf9a",
  background: "#fff",
  color: "#6d6356",
};

const badge = (color: string): React.CSSProperties => ({
  position: "absolute",
  top: 4,
  right: 4,
  width: 20,
  height: 20,
  borderRadius: "50%",
  background: color,
  color: "#fff",
  fontSize: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});
