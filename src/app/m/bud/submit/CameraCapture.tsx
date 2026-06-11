"use client";

/**
 * ライブカメラ（iPhone カメラ風 UI・縦長レシート枠・はみ出し警告）
 * - getUserMedia 背面カメラのライブ映像。連続撮影できる。
 * - ガイド枠はレシートに合わせた縦長。枠からはみ出した（背景と枠内外の明るさが近い）と
 *   推定したら枠を赤くして「枠内に入れてください」を表示（明暗ヒューリスティック・実機で要調整）。
 * - 撮影でフラッシュ＋振動＋左下サムネ更新。カメラ不可端末は写真選択にフォールバック。
 */

import { useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  count: number;
  max: number;
};

// ガイド枠の位置（画面％・縦長）
const FRAME = { left: 0.18, right: 0.82, top: 0.12, bottom: 0.86 };

type Corner = { t?: number; b?: number; l?: number; r?: number; bt?: boolean; bb?: boolean; bl?: boolean; br?: boolean };
const CORNERS: Corner[] = [
  { t: -2, l: -2, bt: true, bl: true },
  { t: -2, r: -2, bt: true, br: true },
  { b: -2, l: -2, bb: true, bl: true },
  { b: -2, r: -2, bb: true, br: true },
];

export function CameraCapture({ onCapture, onClose, count, max }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyzeRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [shotN, setShotN] = useState(0);
  const [lastThumb, setLastThumb] = useState<string | null>(null);
  const [outOfFrame, setOutOfFrame] = useState(false);

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

  // はみ出し推定ループ（明暗ヒューリスティック・約5fps）
  useEffect(() => {
    if (error) return;
    let raf = 0;
    let last = 0;
    const cv = (analyzeRef.current ||= document.createElement("canvas"));
    cv.width = 80;
    cv.height = 140;
    const ctx = cv.getContext("2d", { willReadFrequently: true });

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 200) return;
      last = t;
      const v = videoRef.current;
      if (!v || !v.videoWidth || !ctx) return;
      ctx.drawImage(v, 0, 0, cv.width, cv.height);
      let img: ImageData;
      try {
        img = ctx.getImageData(0, 0, cv.width, cv.height);
      } catch {
        return;
      }
      const lum = (x: number, y: number) => {
        const i = (y * cv.width + x) * 4;
        return (img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114) / 255;
      };
      const L = Math.round(FRAME.left * cv.width);
      const R = Math.round(FRAME.right * cv.width);
      const T = Math.round(FRAME.top * cv.height);
      const B = Math.round(FRAME.bottom * cv.height);
      let inSum = 0;
      let inN = 0;
      for (let y = T; y < B; y += 4) {
        for (let x = L; x < R; x += 4) {
          inSum += lum(x, y);
          inN++;
        }
      }
      const band = 5;
      let outSum = 0;
      let outN = 0;
      for (let y = Math.max(0, T - band); y < B + band && y < cv.height; y += 3) {
        for (let x = Math.max(0, L - band); x < R + band && x < cv.width; x += 3) {
          const inside = x >= L && x < R && y >= T && y < B;
          if (!inside) {
            outSum += lum(x, y);
            outN++;
          }
        }
      }
      const inAvg = inN ? inSum / inN : 0;
      const outAvg = outN ? outSum / outN : 0;
      // レシート（明るい）が枠外にもはみ出す＝枠外も枠内と同じくらい明るい
      const spilling = inAvg > 0.45 && outAvg > inAvg * 0.82;
      setOutOfFrame(spilling);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [error]);

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
        setLastThumb((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        try {
          navigator.vibrate?.(40);
        } catch {
          /* 非対応端末は無視 */
        }
        setFlash(true);
        setTimeout(() => setFlash(false), 150);
      },
      "image/jpeg",
      0.9,
    );
  };

  const frameColor = outOfFrame ? "#ff3b30" : "rgba(255,255,255,0.95)";

  return (
    <div style={overlay}>
      {/* 上部バー */}
      <div style={topBar}>
        <button type="button" onClick={onClose} style={topBtn} aria-label="閉じる">
          ✕
        </button>
        <span style={{ color: "#fff", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
          {count} / {max}
        </span>
        <span style={{ width: 40 }} />
      </div>

      {/* 映像 + 縦長ガイド枠 */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden", background: "#000" }}>
        {!error && (
          <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {!error && (
          <>
            <div
              style={{
                position: "absolute",
                left: `${FRAME.left * 100}%`,
                right: `${(1 - FRAME.right) * 100}%`,
                top: `${FRAME.top * 100}%`,
                bottom: `${(1 - FRAME.bottom) * 100}%`,
                border: `2px solid ${frameColor}`,
                borderRadius: 14,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                transition: "border-color 0.15s",
              }}
              aria-hidden
            >
              {/* コーナーブラケット（iPhone風） */}
              {CORNERS.map((c, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    width: 22,
                    height: 22,
                    top: c.t,
                    bottom: c.b,
                    left: c.l,
                    right: c.r,
                    borderTop: c.bt ? `4px solid ${frameColor}` : undefined,
                    borderBottom: c.bb ? `4px solid ${frameColor}` : undefined,
                    borderLeft: c.bl ? `4px solid ${frameColor}` : undefined,
                    borderRight: c.br ? `4px solid ${frameColor}` : undefined,
                    borderRadius: 6,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                top: `${FRAME.bottom * 100 + 2}%`,
                left: 0,
                right: 0,
                textAlign: "center",
                color: outOfFrame ? "#ff3b30" : "#fff",
                fontSize: 14,
                fontWeight: outOfFrame ? 700 : 400,
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}
            >
              {outOfFrame ? "枠内に入れてください" : "枠に合わせて撮影"}
            </div>
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

      {/* 下部バー（iPhone 風：左サムネ / 中央シャッター / 右完了） */}
      {!error && (
        <div style={bottomBar}>
          <div style={sideSlot}>
            {lastThumb && (
              <div style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lastThumb} alt="" style={thumbImg} />
                {shotN > 0 && <span style={thumbCount}>{shotN}</span>}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={shoot}
            disabled={atMax}
            aria-label="撮影"
            style={{ ...shutter, opacity: atMax ? 0.4 : 1 }}
          >
            <span style={shutterInner} />
          </button>
          <div style={{ ...sideSlot, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={doneBtn}>
              完了
            </button>
          </div>
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
  padding: "calc(8px + env(safe-area-inset-top)) 16px 8px",
  background: "#000",
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
const flashStyle: React.CSSProperties = { position: "absolute", inset: 0, background: "#fff", opacity: 0.85 };
const bottomBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "18px 24px calc(22px + env(safe-area-inset-bottom))",
  background: "#000",
};
const sideSlot: React.CSSProperties = { width: 64, display: "flex", alignItems: "center" };
const shutter: React.CSSProperties = {
  width: 74,
  height: 74,
  borderRadius: "50%",
  border: "4px solid #fff",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};
const shutterInner: React.CSSProperties = { width: 60, height: 60, borderRadius: "50%", background: "#fff", display: "block" };
const doneBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#ffd60a",
  fontSize: 16,
  fontWeight: 700,
};
const thumbImg: React.CSSProperties = {
  width: 48,
  height: 48,
  objectFit: "cover",
  borderRadius: 8,
  border: "2px solid rgba(255,255,255,0.85)",
};
const thumbCount: React.CSSProperties = {
  position: "absolute",
  top: -6,
  right: -6,
  minWidth: 18,
  height: 18,
  padding: "0 4px",
  borderRadius: 9,
  background: "#E07A9B",
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
