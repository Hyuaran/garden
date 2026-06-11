"use client";

/**
 * ライブカメラ（iPhone カメラ風 UI・ゆるい縦長ガイド枠）
 * - getUserMedia 背面カメラのライブ映像。連続撮影できる。
 * - ガイド枠は「ここを切り取る」範囲。厳密な判定や赤エラーはしない（案A）。
 * - 撮影後、ガイド枠の線に合わせて切り取って保存（経理が見やすい一定の画角に）。
 *   object-fit:cover の表示→映像ピクセルへ座標変換して切り出す。
 * - 撮影でフラッシュ＋振動＋左下サムネへ吸い込みアニメ。カメラ不可端末は写真選択にフォールバック。
 */

import { useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  count: number;
  max: number;
};

// ガイド枠の位置（画面％・縦長）
const FRAME = { left: 0.16, right: 0.84, top: 0.11, bottom: 0.87 };

type Corner = { t?: number; b?: number; l?: number; r?: number; bt?: boolean; bb?: boolean; bl?: boolean; br?: boolean };
const CORNERS: Corner[] = [
  { t: -2, l: -2, bt: true, bl: true },
  { t: -2, r: -2, bt: true, br: true },
  { b: -2, l: -2, bb: true, bl: true },
  { b: -2, r: -2, bb: true, br: true },
];

// ガイド枠の線に合わせて切り取る。画面は object-fit:cover で表示されているため、
// 表示コンテナ上の枠％を実際の映像ピクセル座標へ変換してから切り出す。
function cropVideoToFrame(v: HTMLVideoElement): HTMLCanvasElement {
  const vw = v.videoWidth;
  const vh = v.videoHeight;
  const out = document.createElement("canvas");
  const draw = (sx: number, sy: number, sw: number, sh: number) => {
    out.width = Math.max(1, Math.round(sw));
    out.height = Math.max(1, Math.round(sh));
    out.getContext("2d")?.drawImage(v, sx, sy, sw, sh, 0, 0, out.width, out.height);
  };
  const cw = v.clientWidth;
  const ch = v.clientHeight;
  if (!vw || !vh) {
    out.width = 1;
    out.height = 1;
    return out;
  }
  if (!cw || !ch) {
    // フォールバック：枠％を映像にそのまま適用
    draw(FRAME.left * vw, FRAME.top * vh, (FRAME.right - FRAME.left) * vw, (FRAME.bottom - FRAME.top) * vh);
    return out;
  }
  const scale = Math.max(cw / vw, ch / vh); // cover
  const offX = (vw * scale - cw) / 2;
  const offY = (vh * scale - ch) / 2;
  const vx0 = (FRAME.left * cw + offX) / scale;
  const vy0 = (FRAME.top * ch + offY) / scale;
  const vx1 = (FRAME.right * cw + offX) / scale;
  const vy1 = (FRAME.bottom * ch + offY) / scale;
  const sx = Math.max(0, vx0);
  const sy = Math.max(0, vy0);
  const sw = Math.min(vw - sx, vx1 - vx0);
  const sh = Math.min(vh - sy, vy1 - vy0);
  draw(sx, sy, sw, sh);
  return out;
}

export function CameraCapture({ onCapture, onClose, count, max }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [shotN, setShotN] = useState(0);
  const [lastThumb, setLastThumb] = useState<string | null>(null);
  const thumbSlotRef = useRef<HTMLDivElement>(null);
  const [flying, setFlying] = useState<{ id: string; url: string }[]>([]);
  const flyKey = useRef(0);
  const animatedSet = useRef<Set<string>>(new Set());

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

  // 撮った写真を左下サムネへ吸い込むアニメ（iPhone スクショ風）
  const animateFly = (el: HTMLImageElement | null, id: string, url: string) => {
    if (!el || animatedSet.current.has(id)) return;
    animatedSet.current.add(id);
    const remove = () => {
      setFlying((prev) => prev.filter((x) => x.id !== id));
      animatedSet.current.delete(id);
      URL.revokeObjectURL(url);
    };
    const slot = thumbSlotRef.current?.getBoundingClientRect();
    const start = el.getBoundingClientRect();
    if (!slot || !start.width) {
      remove();
      return;
    }
    const targetSize = 48;
    const dx = slot.left + slot.width / 2 - (start.left + start.width / 2);
    const dy = slot.top + slot.height / 2 - (start.top + start.height / 2);
    const scale = targetSize / start.width;
    const anim = el.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.4 },
      ],
      { duration: 430, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
    );
    anim.onfinish = remove;
    anim.oncancel = remove;
  };

  const atMax = count >= max;

  const shoot = () => {
    if (atMax) return;
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const cropped = cropVideoToFrame(v);
    cropped.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(blob);
        setShotN((n) => n + 1);
        setLastThumb((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        flyKey.current += 1;
        const flyId = `f${flyKey.current}`;
        setFlying((f) => [...f, { id: flyId, url: URL.createObjectURL(blob) }]);
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

      {/* 映像 + ゆるい縦長ガイド枠 */}
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
                border: "2px solid rgba(255,255,255,0.85)",
                borderRadius: 14,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
              }}
              aria-hidden
            >
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
                    borderTop: c.bt ? "3px solid rgba(255,255,255,0.9)" : undefined,
                    borderBottom: c.bb ? "3px solid rgba(255,255,255,0.9)" : undefined,
                    borderLeft: c.bl ? "3px solid rgba(255,255,255,0.9)" : undefined,
                    borderRight: c.br ? "3px solid rgba(255,255,255,0.9)" : undefined,
                    borderRadius: 6,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: `${(1 - FRAME.top) * 100 + 1}%`,
                left: 0,
                right: 0,
                textAlign: "center",
                color: "#ff3b30",
                fontWeight: 700,
                fontSize: 13,
                lineHeight: 1.5,
                padding: "0 12px",
                textShadow: "0 1px 3px rgba(0,0,0,0.85)",
              }}
            >
              枠の中だけが保存されるので、
              <br />
              領収書は枠いっぱいに入れて撮影すること
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
          <div style={sideSlot} ref={thumbSlotRef}>
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

      {/* 撮影→左下サムネへ吸い込むアニメ */}
      {flying.map((f) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={f.id} src={f.url} alt="" style={flyStart} ref={(el) => animateFly(el, f.id, f.url)} />
      ))}
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
const doneBtn: React.CSSProperties = { background: "transparent", border: "none", color: "#ffd60a", fontSize: 16, fontWeight: 700 };
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
const flyStart: React.CSSProperties = {
  position: "fixed",
  left: "22vw",
  top: "28vh",
  width: "56vw",
  height: "42vh",
  objectFit: "cover",
  borderRadius: 12,
  border: "2px solid rgba(255,255,255,0.9)",
  zIndex: 1100,
  pointerEvents: "none",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
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
