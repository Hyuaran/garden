"use client";

/**
 * Garden Series 統一ログイン画面 (v8 unified, 2026-05-07)
 *
 * 起源: claude.ai 起草版 _chat_workspace/garden-ui-concept/login.html (2026-05-03)
 * dispatch: main- No. 83 / No. 84 (a-main-013, 5/8 デモ延期 + Garden 統一認証)
 *
 * 旧版: page.legacy-bloom-original-login-20260507.tsx (v7 Group B、削除禁止)
 *
 * 設計:
 *   - 背景画像 bg-login-twilight-with-card.png (1870×841、カード装飾込み) を画面全体 cover
 *   - 画像内のカード枠位置に透明な <input> と <button> を JS で重ね合わせ
 *   - window resize で常に画像基準の座標を再計算
 *   - フォント: Cormorant Garamond + Noto Serif JP + Noto Sans JP
 *
 * dispatch 判断保留 5 件 結果 (main- No. 84):
 *   - #2 機能: 目アイコン残す + 状態保持残す + 他 3 件廃止 (パスワード忘れ / E-/P- prefix / microcopy)
 *   - #3 input type: type="password" + 目アイコン切替
 *   - #4 認証: signInBloom + fetchBloomUser + getPostLoginRedirect 流用継続
 */

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { signInBloom, fetchBloomUser } from "../bloom/_lib/auth";
import { getPostLoginRedirect } from "../_lib/auth-redirect";

// 背景画像の物理サイズ (bg-login-twilight-with-card.png)
const BG_W = 1870;
const BG_H = 841;

// 画像内のカード要素座標 (claude.ai 起草版 CARD_COORDS そのまま、1870×841 基準)
const CARD = {
  idInput: { top: 378, left: 766, width: 334, height: 50 },
  pwInput: { top: 483, left: 766, width: 334, height: 50 },
  enter: { top: 555, left: 815, width: 240, height: 60 },
  // v7 機能保持 (世界観に馴染ませた追加配置)
  pwToggle: { top: 483, left: 1054, width: 46, height: 50 }, // pwInput 右内側
  remember: { top: 628, left: 766, width: 334, height: 24 }, // カード枠下
  error: { top: 660, left: 766, width: 334, height: 50 }, // remember の下
};

type Rect = { scale: number; offsetX: number; offsetY: number };

function calculateBgRect(winW: number, winH: number): Rect {
  const imgRatio = BG_W / BG_H;
  const winRatio = winW / winH;
  if (winRatio < imgRatio) {
    const scale = winH / BG_H;
    return { scale, offsetX: (winW - BG_W * scale) / 2, offsetY: 0 };
  }
  const scale = winW / BG_W;
  return { scale, offsetX: 0, offsetY: (winH - BG_H * scale) / 2 };
}

function coordsToCss(coords: typeof CARD.idInput, rect: Rect): CSSProperties {
  return {
    position: "absolute",
    top: rect.offsetY + coords.top * rect.scale,
    left: rect.offsetX + coords.left * rect.scale,
    width: coords.width * rect.scale,
    height: coords.height * rect.scale,
  };
}

export default function GardenLoginPage() {
  const router = useRouter();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLogin, setKeepLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rect, setRect] = useState<Rect>({ scale: 1, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    const update = () => setRect(calculateBgRect(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const idInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    idInputRef.current?.focus();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const trimmed = empId.trim();
    const result = await signInBloom(trimmed, password);
    if (!result.success) {
      setSubmitting(false);
      setError(result.error ?? "ログイン失敗");
      return;
    }
    try {
      const bloomUser = result.userId ? await fetchBloomUser(result.userId) : null;
      const target = getPostLoginRedirect(bloomUser?.garden_role);
      // keepLogin: 状態保持 (Supabase Auth は当面デフォルト挙動、5/13 以降 cookie 永続化を見直し)
      router.push(target);
    } catch (err) {
      setSubmitting(false);
      setError(`ロール取得失敗: ${(err as Error).message}`);
    }
  };

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        margin: 0,
        padding: 0,
        overflow: "hidden",
        fontFamily: "'Noto Sans JP', sans-serif",
        color: "#fdfbf3",
      }}
    >
      {/* 背景：完成版ログイン画面 (カード装飾込み) */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          backgroundImage: "url('/themes/garden-login/bg-login-twilight-with-card.png')",
          backgroundPosition: "center center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#1a1a2e",
        }}
      />

      {/* 左上ロゴ (CSS で重ねる、画像内のロゴは ChatGPT 側で削除済み) */}
      <header
        style={{
          position: "absolute",
          top: 26,
          left: 36,
          zIndex: 10,
          height: 175,
        }}
      >
        <img
          src="/themes/garden-login/logo-garden-series.png"
          alt="Garden Series"
          style={{
            height: "100%",
            width: "auto",
            display: "block",
            filter:
              "drop-shadow(0 2px 8px rgba(0,0,0,0.18)) drop-shadow(0 0 20px rgba(255,255,255,0.4))",
          }}
        />
      </header>

      {/* ログインフォーム (入力欄とボタンは画像枠に重ね合わせ) */}
      <form
        onSubmit={onSubmit}
        aria-label="Garden Series ログイン"
        data-testid="login-form"
        style={{ position: "fixed", inset: 0, zIndex: 5, pointerEvents: "none" }}
      >
        {/* 社員番号入力 (透明、画像内の枠の上に重なる) */}
        <input
          ref={idInputRef}
          type="text"
          value={empId}
          onChange={(e) => setEmpId(e.target.value)}
          placeholder="例 12345"
          autoComplete="username"
          aria-label="社員番号"
          required
          data-testid="login-empid"
          style={{
            ...coordsToCss(CARD.idInput, rect),
            pointerEvents: "auto",
            padding: "0 22px",
            fontFamily: "'Noto Sans JP', sans-serif",
            fontSize: 16,
            color: "#fdfbf3",
            background: "transparent",
            border: "none",
            outline: "none",
            letterSpacing: "0.04em",
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          }}
        />

        {/* パスワード入力 (透明、画像内の枠の上に重なる) */}
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="誕生日 4 桁  例 0801"
          autoComplete="current-password"
          aria-label="パスワード"
          required
          data-testid="login-password"
          style={{
            ...coordsToCss(CARD.pwInput, rect),
            pointerEvents: "auto",
            padding: "0 22px",
            fontFamily: "'Noto Sans JP', sans-serif",
            fontSize: 16,
            color: "#fdfbf3",
            background: "transparent",
            border: "none",
            outline: "none",
            letterSpacing: "0.04em",
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          }}
        />

        {/* 目アイコン (パスワード表示切替、世界観ゴールド系) */}
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
          data-testid="login-password-toggle"
          tabIndex={0}
          style={{
            ...coordsToCss(CARD.pwToggle, rect),
            pointerEvents: "auto",
            background: "transparent",
            border: "none",
            outline: "none",
            cursor: "pointer",
            color: "#e8c069",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          {showPassword ? "🙈" : "👁"}
        </button>

        {/* Enter ボタン (透明、画像内のボタンの上に重なる) */}
        <button
          type="submit"
          disabled={submitting}
          aria-label="Enter (庭園に入る)"
          data-testid="login-submit"
          style={{
            ...coordsToCss(CARD.enter, rect),
            pointerEvents: submitting ? "none" : "auto",
            background: submitting ? "rgba(255,230,150,0.10)" : "transparent",
            border: "none",
            outline: "none",
            cursor: submitting ? "not-allowed" : "pointer",
            borderRadius: 999,
            transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            color: "transparent",
          }}
          onMouseEnter={(e) => {
            if (submitting) return;
            (e.currentTarget as HTMLButtonElement).style.background =
              "radial-gradient(ellipse at center, rgba(255,230,150,0.20) 0%, rgba(232,192,105,0.08) 60%, transparent 100%)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 0 28px rgba(232,192,105,0.32)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
          }}
        >
          {submitting ? "..." : ""}
        </button>

        {/* 状態保持 checkbox (カード枠下、世界観に馴染ませる Cormorant + ゴールド) */}
        <label
          style={{
            ...coordsToCss(CARD.remember, rect),
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            cursor: "pointer",
            color: "#fdfbf3",
            fontSize: Math.max(11, 13 * rect.scale),
            fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
            fontStyle: "italic",
            letterSpacing: "0.04em",
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            opacity: 0.85,
          }}
        >
          <input
            type="checkbox"
            checked={keepLogin}
            onChange={(e) => setKeepLogin(e.target.checked)}
            data-testid="login-keep"
            style={{
              accentColor: "#d4a541",
              cursor: "pointer",
            }}
          />
          ログイン状態を保持する
        </label>

        {/* エラー表示 (カード枠下) */}
        {error && (
          <p
            role="alert"
            data-testid="login-error"
            style={{
              ...coordsToCss(CARD.error, rect),
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 12px",
              margin: 0,
              color: "#ffd7d7",
              background: "rgba(120,20,20,0.45)",
              border: "1px solid rgba(255,180,180,0.5)",
              borderRadius: 8,
              fontSize: Math.max(11, 13 * rect.scale),
              textShadow: "0 1px 4px rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
            }}
          >
            ⚠️ {error}
          </p>
        )}
      </form>
    </main>
  );
}
