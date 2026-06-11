"use client";

/**
 * Garden モバイル — 経費申請（撮影〜選択〜送信）
 * Phase 2 第1版：枠カメラ（スマホ純正カメラ）で連続撮影 → 選択（全選択/全解除・失敗は選択不可）→ 送信。
 * ※撮影は <input type=file capture> 方式（全機種で確実・高画質）。ライブ枠プレビューは後続で強化。
 * ※送信の実保存(DB/Storage)とOCRは後続フェーズで接続（本版は撮影〜選択UXと送信導線まで）。
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

import { CameraCapture } from "./CameraCapture";

type Shot = {
  id: string;
  url: string;
  ts: number;
  selected: boolean;
  failed: boolean;
  rotation: number; // 0/90/180/270
};

const MAX_SHOTS = 50;

// 画像を指定角度に回転した Blob を返す
async function rotateBlob(blob: Blob, deg: number): Promise<Blob> {
  if (!deg) return blob;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    const rad = (deg * Math.PI) / 180;
    const swap = deg % 180 !== 0;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? img.height : img.width;
    canvas.height = swap ? img.width : img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? blob), "image/jpeg", 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}

type ExpenseKind = "individual" | "company";

export default function MobileExpenseSubmit() {
  const [kind, setKind] = useState<ExpenseKind>("individual"); // 個別経費が多数のため既定
  const [shots, setShots] = useState<Shot[]>([]);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const seq = useRef(0);
  const router = useRouter();

  const addShot = (blob: Blob) => {
    seq.current += 1;
    const shot: Shot = {
      id: `s${seq.current}`,
      url: URL.createObjectURL(blob),
      ts: Date.now(),
      selected: true,
      failed: false,
      rotation: 0,
    };
    setShots((prev) => (prev.length >= MAX_SHOTS ? prev : [...prev, shot]));
    setSent(false);
  };

  const rotateShot = (id: string) =>
    setShots((prev) => prev.map((s) => (s.id === id && !s.failed ? { ...s, rotation: (s.rotation + 90) % 360 } : s)));

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

  const submit = async () => {
    if (selectedCount === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createBrowserClient();

      // ログイン中の本人を auth から特定 → 本人の社員IDだけを取得（管理者でも自分1件に絞る）
      const { data: auth } = await supabase.auth.getUser();
      const authUserId = auth?.user?.id ?? null;
      if (!authUserId) {
        setError("ログインが切れています。ログインし直してください。");
        setSubmitting(false);
        return;
      }
      const { data: emp } = await supabase
        .from("root_employees")
        .select("employee_id")
        .eq("user_id", authUserId)
        .maybeSingle<{ employee_id: string }>();
      const empId = emp?.employee_id ?? null;
      if (!empId) {
        setError("社員情報が見つかりませんでした（このアカウントに社員データが紐づいていない可能性）。");
        setSubmitting(false);
        return;
      }

      // 現状は会社経費も個別経費と同じフロー（承認待ちから）。
      // 将来：会社経費は承認済みのため仕訳化へ直行に切替予定。
      const status = "submitted";
      const targets = shots.filter((s) => s.selected && !s.failed);

      for (const shot of targets) {
        let blob = await (await fetch(shot.url)).blob();
        if (shot.rotation) blob = await rotateBlob(blob, shot.rotation);
        const path = `${empId}/${shot.ts}-${shot.id}.jpg`;
        const up = await supabase.storage
          .from("bud-receipts")
          .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
        if (up.error) throw up.error;

        const ins = await supabase.from("bud_expense_requests").insert({
          applicant_employee_id: empId,
          expense_kind: kind,
          status,
          drive_file_id: up.data?.path ?? path, // 暫定: Storage パスを保持（Drive連携で置換）
        });
        if (ins.error) throw ins.error;
      }
      setSentCount(targets.length);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
    setSent(false);
    setSentCount(0);
    setError(null);
  };

  // 送信完了画面（専用ページ）
  if (sent) {
    return (
      <main style={successMain}>
        <div style={{ textAlign: "center" }}>
          <div style={successCheck}>✓</div>
          <h2 style={{ fontSize: 22, color: "#3d3528", margin: "20px 0 10px", fontWeight: 700 }}>送信しました</h2>
          <p style={{ color: "#6d6356", fontSize: 14, lineHeight: 1.7 }}>
            {sentCount}件の領収書を経理へ送りました。
            <br />
            内容の確認・承認をお待ちください。
          </p>
        </div>
        <div style={successBar}>
          <button type="button" onClick={resetForm} style={successSubBtn}>
            続けて申請する
          </button>
          <button type="button" onClick={() => router.push("/m/bud")} style={successMainBtn}>
            Bud トップへ戻る
          </button>
        </div>
      </main>
    );
  }

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

      {/* 経費区分の選択（1回の送信は片方のみ） */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {([
            { v: "individual", label: "個別経費", sub: "これから承認を取る" },
            { v: "company", label: "会社経費", sub: "承認済み・報告用" },
          ] as const).map((opt) => {
            const active = kind === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => setKind(opt.v)}
                aria-pressed={active}
                style={{
                  flex: 1,
                  padding: "12px 8px",
                  borderRadius: 12,
                  border: active ? "2px solid #E07A9B" : "2px solid #d8d4c8",
                  background: active ? "rgba(224,122,155,0.10)" : "#fff",
                  color: active ? "#b3406a" : "#6d6356",
                  fontWeight: active ? 700 : 500,
                }}
              >
                <div style={{ fontSize: 15 }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: active ? "#b3406a" : "#9a8f7d", marginTop: 2 }}>{opt.sub}</div>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: "#9a8f7d", marginTop: 6, textAlign: "center" }}>
          ※ 1回の送信は{kind === "individual" ? "個別経費" : "会社経費"}のみ。混在させず分けて送ってください。
        </div>
      </div>

      {/* ライブカメラ（連写＋ガイド枠） */}
      {cameraOpen && (
        <CameraCapture
          onCapture={addShot}
          onClose={() => setCameraOpen(false)}
          count={shots.length}
          max={MAX_SHOTS}
        />
      )}

      {/* 撮影ボタン */}
      <button
        type="button"
        onClick={() => setCameraOpen(true)}
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
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    transform: `rotate(${s.rotation}deg)`,
                  }}
                />
                {s.selected && !s.failed && (
                  <span style={badge("#E07A9B")}>✓</span>
                )}
                {!s.failed && (
                  <span
                    role="button"
                    aria-label="回転"
                    onClick={(e) => {
                      e.stopPropagation();
                      rotateShot(s.id);
                    }}
                    style={rotateBtn}
                  >
                    ↻
                  </span>
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
          {error && (
            <div style={{ color: "#c0392b", fontSize: 12, textAlign: "center", marginBottom: 8 }}>{error}</div>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={selectedCount === 0 || submitting}
            style={{
              width: "100%",
              padding: 15,
              fontSize: 16,
              fontWeight: 700,
              color: "#fff",
              background: selectedCount === 0 || submitting ? "#bbb" : "#5e7d44",
              border: "none",
              borderRadius: 14,
            }}
          >
            {submitting ? "送信中…" : `選択した ${selectedCount} 件を送信`}
          </button>
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

const rotateBtn: React.CSSProperties = {
  position: "absolute",
  left: 4,
  bottom: 4,
  width: 26,
  height: 26,
  borderRadius: "50%",
  background: "rgba(0,0,0,0.55)",
  color: "#fff",
  fontSize: 15,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const successMain: React.CSSProperties = {
  minHeight: "100dvh",
  background: "#f7f4ec",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 20px calc(120px + env(safe-area-inset-bottom))",
  maxWidth: 560,
  margin: "0 auto",
};
const successCheck: React.CSSProperties = {
  width: 88,
  height: 88,
  borderRadius: "50%",
  background: "#5e7d44",
  color: "#fff",
  fontSize: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto",
  boxShadow: "0 6px 18px rgba(94,125,68,0.35)",
};
const successBar: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "14px 16px calc(16px + env(safe-area-inset-bottom))",
  background: "rgba(247,244,236,0.96)",
  borderTop: "1px solid #e2ddcf",
  maxWidth: 560,
  margin: "0 auto",
};
const successMainBtn: React.CSSProperties = {
  width: "100%",
  padding: 15,
  fontSize: 16,
  fontWeight: 700,
  color: "#fff",
  background: "#E07A9B",
  border: "none",
  borderRadius: 14,
};
const successSubBtn: React.CSSProperties = {
  width: "100%",
  padding: 13,
  fontSize: 15,
  fontWeight: 600,
  color: "#6d6356",
  background: "#fff",
  border: "1px solid #cdbf9a",
  borderRadius: 14,
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
