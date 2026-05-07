"use client";

/**
 * Garden Series ホーム画面 v9 unified (2026-05-07)
 *
 * 起源: claude.ai 起草版 _chat_workspace/garden-ui-concept/garden-home.html (2026-05-03)
 * dispatch: main- No. 83 / No. 84 / No. 86 / No. 87 (a-main-013 Garden 統一認証ゲート + ガンガンモード)
 *
 * 旧版: page.legacy-v28a-step5-20260507.tsx (v2.8a Step 5、削除禁止)
 *
 * 設計:
 *   - 背景: bg-night-garden-with-stars.png (cover、夜の庭園 + 流れ星焼き込み)
 *   - 中央: 12 モジュール円環 (真円配置、vmin 基準、10 分 / 周の自動回転)
 *   - 各バブル: hover で停止 + 中央パネル表示、click で sparkle 演出 → 0.7秒後 routing
 *   - ホイール: 加減速 (BASE 10分/周、MAX 1.25秒/周)
 *   - フォント: Cormorant Garamond + Shippori Mincho + Noto Serif JP (layout.tsx で provider 済)
 *
 * dispatch 確定事項:
 *   - claude.ai 起草版そのまま採用、a-bloom-004 既存 BackgroundCarousel 等 v2.8a 系は破棄
 *   - 後道さん UX 採用ゲート (実物必須・遊び心・世界観) 通過レベル
 *   - 認証ゲートは a-root-002 が 5/9-12 で共通化、当面 / は誰でも見える
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Tone = "soft" | "mid" | "strong";

type Module = {
  mod: string;
  name: string;
  jp: string;
  desc: string;
  tone: Tone;
  href: string;
};

// 12 モジュール (時計回り、12 時開始)
const MODULES: Module[] = [
  {
    mod: "bloom",
    name: "Bloom",
    jp: "案件・KPI",
    desc: "業務全体の健康状態を花のように咲かせる。案件一覧、日報、KPI、経営ダッシュボードを担う。",
    tone: "soft",
    href: "/bloom",
  },
  {
    mod: "bud",
    name: "Bud",
    jp: "経理・収支",
    desc: "これから花開く蕾。明細・振込・損益・給与など、経理と収支のすべてを育てるモジュール。",
    tone: "soft",
    href: "/bud",
  },
  {
    mod: "calendar",
    name: "Calendar",
    jp: "予定管理",
    desc: "日々の流れを整える暦。営業予定、シフト、スケジュール管理を担うモジュール。",
    tone: "soft",
    href: "/calendar",
  },
  {
    mod: "fruit",
    name: "Fruit",
    jp: "法人実体情報",
    desc: "実った成果。法人番号、登記、許認可、Pマーク等。法人格の実体情報を一元管理するモジュール。",
    tone: "strong",
    href: "/fruit",
  },
  {
    mod: "leaf",
    name: "Leaf",
    jp: "個別アプリ",
    desc: "商材×商流ごとに独立した葉。光コラボ、新電力、クレジット、法人携帯ほか各事業の業務アプリ。",
    tone: "soft",
    href: "/leaf",
  },
  {
    mod: "rill",
    name: "Rill",
    jp: "メッセージ",
    desc: "情報を運ぶ川。Chatworkクローン、社内メッセージ、通知。すべてのモジュールに情報を届ける流れ。",
    tone: "mid",
    href: "/rill",
  },
  {
    mod: "root",
    name: "Root",
    jp: "組織マスタ",
    desc: "強く、しなやかな組織をつくる。すべての事業の土台となる基盤を育みます。",
    tone: "strong",
    href: "/root",
  },
  {
    mod: "seed",
    name: "Seed",
    jp: "新事業",
    desc: "まだ蒔かれていない種。新規事業、新商材、未来の業務領域。森が広がっていくための余白。",
    tone: "mid",
    href: "/seed",
  },
  {
    mod: "soil",
    name: "Soil",
    jp: "DB基盤",
    desc: "森を育てる肥沃な土壌。営業リスト、コール履歴などの大規模データを蓄える、すべての養分の源。",
    tone: "strong",
    href: "/soil",
  },
  {
    mod: "sprout",
    name: "Sprout",
    jp: "採用",
    desc: "これから芽吹く双葉。求人、面接、新人研修、スキル管理。組織の未来を育てるモジュール。",
    tone: "soft",
    href: "/sprout",
  },
  {
    mod: "tree",
    name: "Tree",
    jp: "架電",
    desc: "木の幹のように業務を支える。架電業務、コール履歴、KPI管理。電話業務の中核を担うモジュール。",
    tone: "mid",
    href: "/tree",
  },
  {
    mod: "forest",
    name: "Forest",
    jp: "全法人決算",
    desc: "森のように全法人を見渡す。グループ全社の決算資料・経営ダッシュボードを束ねる、最も俯瞰的なモジュール。",
    tone: "mid",
    href: "/forest",
  },
];

// 円環パラメータ (claude.ai 起草版そのまま)
const ORBIT_BASE_RADIUS_VMIN = 40;
const CENTER_X_VW = 50;
const CENTER_Y_VH = 50;
const BUBBLE_HALF = 75; // 150px / 2
const BASE_VELOCITY = 0.00001047; // ≒ 10 分 / 周
const MAX_VELOCITY = 0.0008;
const VELOCITY_DECAY = 0.985;
const VELOCITY_BOOST = 0.0002;

export default function GardenHomePage() {
  const router = useRouter();
  const bubbleRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [activeMod, setActiveMod] = useState<string | null>(null);

  // 回転状態は ref で 60fps 動作 (re-render させない)
  const rotationRef = useRef(0);
  const angularVelocityRef = useRef(BASE_VELOCITY);
  const isPausedRef = useRef(false);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const updatePositions = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const vmin = Math.min(w, h);
      const cx = (CENTER_X_VW / 100) * w;
      const cy = (CENTER_Y_VH / 100) * h;
      const r = (ORBIT_BASE_RADIUS_VMIN / 100) * vmin;

      bubbleRefs.current.forEach((el, i) => {
        if (!el) return;
        const baseAngleDeg = i * (360 / MODULES.length) - 90;
        const baseAngleRad = (baseAngleDeg * Math.PI) / 180;
        const angle = baseAngleRad + rotationRef.current;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        el.style.transform = `translate3d(${x - BUBBLE_HALF}px, ${y - BUBBLE_HALF}px, 0)`;
      });
    };

    let rafId = 0;
    lastTimeRef.current = performance.now();
    const tick = (now: number) => {
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (!isPausedRef.current) {
        rotationRef.current += angularVelocityRef.current * dt;
      }

      // 速度減衰: 基準速度に向かってゆっくり戻る
      const v = angularVelocityRef.current;
      if (v > BASE_VELOCITY) {
        angularVelocityRef.current = BASE_VELOCITY + (v - BASE_VELOCITY) * VELOCITY_DECAY;
        if (angularVelocityRef.current - BASE_VELOCITY < 0.000001) {
          angularVelocityRef.current = BASE_VELOCITY;
        }
      } else if (v < BASE_VELOCITY) {
        angularVelocityRef.current = BASE_VELOCITY - (BASE_VELOCITY - v) * VELOCITY_DECAY;
        if (BASE_VELOCITY - angularVelocityRef.current < 0.000001) {
          angularVelocityRef.current = BASE_VELOCITY;
        }
      }

      updatePositions();
      rafId = requestAnimationFrame(tick);
    };

    updatePositions();
    rafId = requestAnimationFrame(tick);
    window.addEventListener("resize", updatePositions);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const boost = (e.deltaY > 0 ? 1 : -1) * VELOCITY_BOOST;
      angularVelocityRef.current += boost;
      if (angularVelocityRef.current > MAX_VELOCITY) angularVelocityRef.current = MAX_VELOCITY;
      if (angularVelocityRef.current < -MAX_VELOCITY)
        angularVelocityRef.current = -MAX_VELOCITY;
    };
    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updatePositions);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  const handleEnter = (mod: string) => {
    isPausedRef.current = true;
    setActiveMod(mod);
  };
  const handleLeave = () => {
    isPausedRef.current = false;
    setActiveMod(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, m: Module) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.classList.remove("click-sparkle");
    void el.offsetWidth; // reflow 強制でアニメ reset
    el.classList.add("click-sparkle");
    window.setTimeout(() => {
      el.classList.remove("click-sparkle");
    }, 1500);
    window.setTimeout(() => {
      router.push(m.href);
    }, 700);
  };

  const activeModule = activeMod ? MODULES.find((m) => m.mod === activeMod) : null;

  return (
    <div className={`garden-stage${activeModule ? " has-active" : ""}`}>
      {/* 背景: 完成版モックアップから切り出した夜の庭園 */}
      <div className="stage-bg" aria-hidden />

      <div className="scene">
        {/* ロゴ */}
        <header className="brand">
          <a href="/" className="brand-link" aria-label="Garden Series ホームへ">
            <img src="/themes/garden-login/logo-garden-series.png" alt="Garden Series" />
          </a>
        </header>

        {/* ヘッダー右メニュー */}
        <nav className="menu" aria-label="ヘッダーメニュー">
          <a href="#" className="menu-item">
            <svg className="menu-icon" viewBox="0 0 24 24">
              <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z" />
            </svg>
            <span>お知らせ</span>
          </a>
          <a href="#" className="menu-item">
            <svg className="menu-icon" viewBox="0 0 24 24">
              <path d="M4 4h16v3H4zM4 10.5h16v3H4zM4 17h16v3H4z" />
            </svg>
            <span>ヘルプ</span>
          </a>
          <a href="/login" className="menu-item menu-logout">
            <svg className="menu-icon" viewBox="0 0 24 24">
              <path d="M16 17l5-5-5-5M21 12H9M12 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" />
            </svg>
            <span>ログアウト</span>
          </a>
        </nav>

        {/* 12 モジュール円環 */}
        <div className="orbit-stage">
          {MODULES.map((m, i) => (
            <a
              key={m.mod}
              ref={(el) => {
                bubbleRefs.current[i] = el;
              }}
              href={m.href}
              data-mod={m.mod}
              className={`bubble tone-${m.tone}`}
              onMouseEnter={() => handleEnter(m.mod)}
              onMouseLeave={handleLeave}
              onClick={(e) => handleClick(e, m)}
            >
              <img className="bubble-img" src={`/_proto/garden-home/icons/${m.mod}.png`} alt={m.name} />
              <div className="bubble-glass-highlight" />
              <div className="bubble-label">
                <div className="bubble-name">{m.name}</div>
                <div className="bubble-jp">{m.jp}</div>
              </div>
            </a>
          ))}
        </div>

        {/* 中央下パネル (hover 時表示) */}
        <div className="info-panel" aria-live="polite">
          <div className="info-name">
            <span className="info-name-en">{activeModule?.name ?? ""}</span>
            <span className="info-name-divider" />
            <span className="info-name-jp">{activeModule?.jp ?? ""}</span>
          </div>
          <div
            className="info-desc"
            dangerouslySetInnerHTML={{
              __html: activeModule
                ? activeModule.desc.replace(/。/g, "。<br>").replace(/<br>$/, "")
                : "",
            }}
          />
          <button
            type="button"
            className="info-button"
            onClick={() => activeModule && router.push(activeModule.href)}
          >
            <span>詳しく見る</span>
            <span className="info-button-arrow">→</span>
          </button>
        </div>

        {/* フッター */}
        <div className="footer-brand">
          <span className="footer-brand-mark" />
          <span>ヒュアラングループ</span>
        </div>
        <div className="footer-links">
          <a href="#">サービスについて</a>
          <a href="#">サポート</a>
          <a href="#">会社情報</a>
          <a href="#">プライバシーポリシー</a>
        </div>
      </div>

      <style jsx>{`
        .garden-stage {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          font-family: var(--font-noto-serif-jp), system-ui, sans-serif;
          color: #4a4233;
          background: #f5f0e1;
          cursor: default;
        }
        .stage-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          background-image: url("/themes/garden-login/bg-night-garden-with-stars.png");
          background-position: center center;
          background-size: cover;
          background-repeat: no-repeat;
          background-color: #1a1a2e;
          filter: brightness(1.08) contrast(0.92) saturate(0.95);
        }
        .scene {
          position: relative;
          width: 100vw;
          height: 100vh;
          z-index: 3;
        }
        .brand {
          position: absolute;
          top: 26px;
          left: 36px;
          z-index: 10;
          height: 175px;
        }
        .brand-link {
          display: block;
          height: 100%;
          cursor: pointer;
        }
        .brand img {
          height: 100%;
          width: auto;
          display: block;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.18))
            drop-shadow(0 0 20px rgba(255, 255, 255, 0.4));
        }
        .menu {
          position: absolute;
          top: 36px;
          right: 36px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 28px;
        }
        .menu-item {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.08em;
          color: #fdfbf3;
          text-decoration: none;
          padding: 6px 4px;
          cursor: pointer;
          transition: opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          opacity: 0.95;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.75),
            0 0 16px rgba(0, 0, 0, 0.6);
        }
        .menu-item:hover {
          opacity: 1;
        }
        .menu-icon {
          width: 16px;
          height: 16px;
          fill: none;
          stroke: #fdfbf3;
          stroke-width: 1.8;
          filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 8px rgba(0, 0, 0, 0.6));
        }
        .menu-logout {
          border: 1px solid rgba(253, 251, 243, 0.55);
          border-radius: 22px;
          padding: 8px 18px;
          background: rgba(0, 0, 0, 0.32);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .footer-brand {
          position: absolute;
          bottom: 22px;
          left: 36px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-shippori), serif;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.16em;
          color: #fdfbf3;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.75),
            0 0 16px rgba(0, 0, 0, 0.6);
        }
        .footer-brand-mark {
          width: 14px;
          height: 14px;
          display: inline-block;
          border: 1px solid currentColor;
          transform: rotate(45deg);
          position: relative;
          filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.7));
        }
        .footer-brand-mark::after {
          content: "";
          position: absolute;
          inset: 3px;
          border: 1px solid currentColor;
        }
        .footer-links {
          position: absolute;
          bottom: 22px;
          right: 36px;
          z-index: 10;
          display: flex;
          gap: 28px;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.1em;
          color: #fdfbf3;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.75),
            0 0 16px rgba(0, 0, 0, 0.6);
        }
        .footer-links a {
          color: inherit;
          text-decoration: none;
          transition: opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          opacity: 0.9;
        }
        .footer-links a:hover {
          opacity: 1;
        }
        .orbit-stage {
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
        }
        .bubble {
          position: absolute;
          left: 0;
          top: 0;
          pointer-events: auto;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          text-decoration: none;
          width: 150px;
          height: 150px;
          display: block;
          will-change: transform;
        }
        .bubble::before {
          content: "";
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(255, 245, 200, 0.35) 0%,
            rgba(255, 230, 170, 0.18) 35%,
            rgba(255, 230, 170, 0) 70%
          );
          pointer-events: none;
          animation: gentleGlow 4s ease-in-out infinite;
          z-index: -1;
        }
        @keyframes gentleGlow {
          0%,
          100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }
        .bubble:nth-child(2)::before {
          animation-delay: -0.5s;
        }
        .bubble:nth-child(3)::before {
          animation-delay: -1s;
        }
        .bubble:nth-child(4)::before {
          animation-delay: -1.5s;
        }
        .bubble:nth-child(5)::before {
          animation-delay: -2s;
        }
        .bubble:nth-child(6)::before {
          animation-delay: -2.5s;
        }
        .bubble:nth-child(7)::before {
          animation-delay: -3s;
        }
        .bubble:nth-child(8)::before {
          animation-delay: -3.5s;
        }
        .bubble:nth-child(9)::before {
          animation-delay: -0.8s;
        }
        .bubble:nth-child(10)::before {
          animation-delay: -1.3s;
        }
        .bubble:nth-child(11)::before {
          animation-delay: -1.8s;
        }
        .bubble:nth-child(12)::before {
          animation-delay: -2.3s;
        }
        .bubble-img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          filter: drop-shadow(0 6px 18px rgba(120, 100, 70, 0.28))
            drop-shadow(0 0 10px rgba(255, 245, 200, 0.25));
          transition: filter 0.4s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
          display: block;
          position: relative;
          z-index: 1;
        }
        .bubble.tone-soft .bubble-img {
          filter: saturate(1.05) contrast(1.02) drop-shadow(0 6px 18px rgba(120, 100, 70, 0.28))
            drop-shadow(0 0 10px rgba(255, 245, 200, 0.25));
        }
        .bubble.tone-mid .bubble-img {
          filter: saturate(1.15) contrast(1.05) drop-shadow(0 6px 18px rgba(120, 100, 70, 0.28))
            drop-shadow(0 0 10px rgba(255, 245, 200, 0.25));
        }
        .bubble.tone-strong .bubble-img {
          filter: saturate(1.3) contrast(1.08) brightness(1.05)
            drop-shadow(0 6px 18px rgba(120, 100, 70, 0.28))
            drop-shadow(0 0 10px rgba(255, 245, 200, 0.25));
        }
        .bubble-glass-highlight {
          position: absolute;
          top: 8%;
          left: 12%;
          width: 38%;
          height: 30%;
          border-radius: 50%;
          background: radial-gradient(
            ellipse at 30% 30%,
            rgba(255, 255, 255, 0.4) 0%,
            rgba(255, 255, 255, 0.12) 40%,
            rgba(255, 255, 255, 0) 70%
          );
          pointer-events: none;
          z-index: 2;
          filter: blur(2px);
          opacity: 0.75;
          transition: opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .bubble:hover .bubble-img {
          transform: scale(1.12);
        }
        .bubble.tone-soft:hover .bubble-img {
          filter: saturate(1.25) brightness(1.06) contrast(1.05)
            drop-shadow(0 14px 32px rgba(120, 100, 70, 0.45))
            drop-shadow(0 0 24px rgba(255, 230, 170, 0.7));
        }
        .bubble.tone-mid:hover .bubble-img {
          filter: saturate(1.35) brightness(1.08) contrast(1.08)
            drop-shadow(0 14px 32px rgba(120, 100, 70, 0.45))
            drop-shadow(0 0 24px rgba(255, 230, 170, 0.7));
        }
        .bubble.tone-strong:hover .bubble-img {
          filter: saturate(1.5) brightness(1.12) contrast(1.1)
            drop-shadow(0 14px 32px rgba(120, 100, 70, 0.45))
            drop-shadow(0 0 24px rgba(255, 230, 170, 0.7));
        }
        .bubble:hover .bubble-glass-highlight {
          opacity: 1;
        }
        :global(.bubble.click-sparkle::before) {
          content: "";
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(255, 230, 150, 0.9) 0%,
            rgba(212, 165, 65, 0.5) 35%,
            rgba(212, 165, 65, 0) 70%
          );
          pointer-events: none;
          animation: sparkleFlash 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          z-index: -1;
        }
        @keyframes sparkleFlash {
          0% {
            transform: scale(0.4);
            opacity: 0;
          }
          15% {
            transform: scale(0.7);
            opacity: 0.5;
          }
          35% {
            transform: scale(1);
            opacity: 1;
          }
          55% {
            transform: scale(1.25);
            opacity: 0.75;
          }
          75% {
            transform: scale(1.45);
            opacity: 0.4;
          }
          90% {
            transform: scale(1.6);
            opacity: 0.15;
          }
          100% {
            transform: scale(1.7);
            opacity: 0;
          }
        }
        .bubble-label {
          position: absolute;
          top: calc(100% - 12px);
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          pointer-events: none;
          white-space: nowrap;
          background: radial-gradient(
            ellipse 110% 90% at center,
            rgba(252, 246, 232, 0.25) 0%,
            rgba(252, 246, 232, 0.18) 20%,
            rgba(252, 246, 232, 0.1) 45%,
            rgba(252, 246, 232, 0.04) 75%,
            rgba(252, 246, 232, 0) 100%
          );
          padding: 12px 36px 14px;
          border-radius: 50%;
          min-width: 100px;
        }
        .bubble-name {
          font-family: var(--font-cormorant), serif;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.06em;
          color: #3a2a1a;
          line-height: 1;
          text-shadow: 0 0 8px rgba(255, 250, 235, 1), 0 0 14px rgba(255, 250, 235, 0.85),
            0 0 22px rgba(255, 250, 235, 0.5);
        }
        .bubble-jp {
          font-family: var(--font-shippori), serif;
          font-size: 11.5px;
          font-weight: 500;
          letter-spacing: 0.1em;
          color: #3a2a1a;
          margin-top: 3px;
          text-shadow: 0 0 8px rgba(255, 250, 235, 1), 0 0 14px rgba(255, 250, 235, 0.85),
            0 0 22px rgba(255, 250, 235, 0.5);
        }
        .info-panel {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 480px;
          height: 190px;
          z-index: 7;
          pointer-events: none;
          background: rgba(252, 248, 238, 0.78);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: 1px solid rgba(212, 165, 65, 0.35);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(120, 100, 70, 0.1),
            0 0 30px rgba(212, 165, 65, 0.15) inset;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 38px;
          opacity: 0;
          transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .garden-stage.has-active .info-panel {
          opacity: 1;
          pointer-events: auto;
        }
        .info-name {
          font-family: var(--font-cormorant), serif;
          font-weight: 500;
          font-size: 20px;
          letter-spacing: 0.04em;
          color: #4a4233;
          line-height: 1;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .info-name-en {
          font-style: italic;
        }
        .info-name-divider {
          display: inline-block;
          width: 20px;
          height: 1px;
          background: #d4a541;
          opacity: 0.6;
        }
        .info-name-jp {
          font-family: var(--font-shippori), serif;
          font-style: normal;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.06em;
          color: #4a4233;
        }
        .info-desc {
          font-weight: 400;
          font-size: 11.5px;
          line-height: 1.7;
          color: #4a4233;
          margin-top: 10px;
          text-align: center;
          max-width: 360px;
          letter-spacing: 0.02em;
        }
        .info-button {
          margin-top: 12px;
          font-family: var(--font-shippori), serif;
          font-size: 11.5px;
          letter-spacing: 0.16em;
          color: #4a4233;
          display: flex;
          align-items: center;
          gap: 8px;
          pointer-events: auto;
          cursor: pointer;
          padding: 5px 18px;
          border: 1px solid #d4a541;
          border-radius: 22px;
          background: transparent;
          transition: background 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .info-button:hover {
          background: rgba(212, 165, 65, 0.08);
        }
        .info-button-arrow {
          display: inline-block;
          font-family: var(--font-cormorant), serif;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
