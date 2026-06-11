"use client";

/**
 * ライブカメラ（連写＋ガイド枠）
 * getUserMedia で背面カメラのライブ映像を表示。枠内にレシートを収めてシャッター。
 * 撮影してもこの画面に留まるので連続撮影できる。「完了」で選択画面へ。
 * カメラ不可の端末は写真選択にフォールバック。
 */

import { useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  count: number;
  max: number;
};

export function CameraCapture({ onCapture, onClose, count, max }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [shotN, setShotN] = useState(0); // この起動中に撮った枚数（手応え表示）

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setError("カメラを起動できませんでした。ブラウザのカメラ許可を確認するか、下の「写真を選ぶ」をご利用ください。");
      }
    })();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const atMax = count >= max;

  const shoot = () => {
    if (atMax) return;
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(blob);
        setShotN((n) => n + 1);
        setFlash(true);
        setTimeout(() => setFlash(false), 120);
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <div style={overlay}>
      {/* 上部バー */}
      <div style={topBar}>
        <button type="button" onClick={onClose} style={topBtn} aria-label="閉じる">
          ✕
        </button>
        <span style={{ color: "#fff", fontSize: 13 }}>
          {count} / {max} 枚{shotN > 0 ? `（今 ${shotN}枚）` : ""}
        </span>
        <button type="button" onClick={onClose} style={{ ...topBtn, width: "auto", padding: "0 14px" }}>
          完了
        </button>
      </div>

      {/* 映像 + ガイド枠 */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden", background: "#000" }}>
        {!error && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {!error && (
          <>
            <div style={guideFrame} aria-hidden />
            <div style={guideHint}>枠内にレシートを収めて撮影</div>
          </>
        )}
        {flash && <div style={flashStyle} aria-hidden />}
        {error && (
          <div style={errorBox}>
            <div style={{ marginBottom: 16 }}>{error}</div>
            <label style={fallbackBtn}>
              写真を選ぶ
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  for (const f of Array.from(e.target.files ?? [])) onCapture(f);
                  e.target.value = "";
                  onClose();
                }}
              />
            </label>
          </div>
        )}
      </div>

      {/* シャッター */}
      {!error && (
        <div style={bottomBar}>
          <button
            type="button"
            onClick={shoot}
            disabled={atMax}
            aria-label="撮影"
            style={{ ...shutter, opacity: atMax ? 0.4 : 1 }}
          >
            <span style={shutterInner} />
          </button>
          {atMax && <div style={{ color: "#fff", fontSize: 12, marginTop: 8 }}>最大{max}枚に達しました</div>}
        </div>
      )}
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "#000",
  display: "flex",
  flexDirection: "column",
};
const topBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "calc(8px + env(safe-area-inset-top)) 14px 8px",
  background: "rgba(0,0,0,0.6)",
};
const topBtn: React.CSSProperties = {
  width: 40,
  height: 36,
  borderRadius: 8,
  border: "none",
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  fontSize: 16,
};
const guideFrame: React.CSSProperties = {
  position: "absolute",
  top: "12%",
  left: "8%",
  right: "8%",
  bottom: "18%",
  border: "2px solid rgba(255,255,255,0.9)",
  borderRadius: 12,
  boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)",
};
const guideHint: React.CSSProperties = {
  position: "absolute",
  bottom: "10%",
  left: 0,
  right: 0,
  textAlign: "center",
  color: "#fff",
  fontSize: 13,
  textShadow: "0 1px 3px rgba(0,0,0,0.8)",
};
const flashStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "#fff",
  opacity: 0.8,
};
const bottomBar: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "14px 0 calc(18px + env(safe-area-inset-bottom))",
  background: "rgba(0,0,0,0.6)",
};
const shutter: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: "50%",
  border: "4px solid #fff",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const shutterInner: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "#fff",
  display: "block",
};
const errorBox: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: 14,
  textAlign: "center",
  padding: 24,
};
const fallbackBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 24px",
  borderRadius: 12,
  background: "#E07A9B",
  color: "#fff",
  fontWeight: 700,
};
