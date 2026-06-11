"use client";

/**
 * Garden モバイル ホーム（スマホ入口）
 * ログイン後に 12 モジュールをアイコングリッドで表示する。経費スマホ申請の入口。
 * 既存の MODULES 定義を流用。Bud タップ時はモバイル Bud 画面(/m/bud)へ。
 * （他モジュールのモバイル対応は今後。現状は Bud のみモバイル導線を用意）
 */

import Link from "next/link";

import { MODULES, MODULE_KEYS, type ModuleKey } from "@/components/shared/garden-view/_lib/modules";

// モバイルは Bud のみ専用導線。他は将来モバイル対応するまで「準備中」表示。
const MOBILE_READY: Partial<Record<ModuleKey, string>> = {
  bud: "/m/bud",
};

export default function MobileHomePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg, #f7f4ec 0%, #eef1e8 100%)",
        padding: "24px 16px 40px",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontFamily: "'EB Garamond', serif", fontSize: 22, color: "#3d3528", letterSpacing: "0.04em" }}>
          Garden
        </div>
        <div style={{ fontSize: 12, color: "#7b745f", marginTop: 4 }}>モジュールを選んでください</div>
      </header>

      <section
        aria-label="Garden 12 モジュール"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        {MODULE_KEYS.map((key) => {
          const m = MODULES[key];
          const mobileHref = MOBILE_READY[key];
          const tappable = Boolean(mobileHref);

          const inner = (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                aspectRatio: "1 / 1",
                padding: 10,
                borderRadius: 16,
                background: "rgba(255,255,255,0.9)",
                border: tappable ? `2px solid ${m.color}` : "2px solid #d8d4c8",
                boxShadow: "0 3px 10px rgba(0,0,0,0.05)",
                opacity: tappable ? 1 : 0.5,
              }}
            >
              <img
                src={`/themes/module-icons/${key}.webp`}
                alt=""
                aria-hidden
                width={48}
                height={48}
                style={{ objectFit: "contain", filter: tappable ? "none" : "grayscale(0.6)" }}
              />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: tappable ? "#2b2b2b" : "#8a8475" }}>{m.label}</div>
                <div style={{ fontSize: 9, color: tappable ? "#5c6e5f" : "#a39c8a", marginTop: 2 }}>{m.description}</div>
              </div>
            </div>
          );

          if (tappable) {
            return (
              <Link
                key={key}
                href={mobileHref as string}
                data-module-key={key}
                style={{ textDecoration: "none" }}
              >
                {inner}
              </Link>
            );
          }
          return (
            <div key={key} data-module-key={key} aria-disabled="true" title={`${m.label} — モバイル準備中`}>
              {inner}
            </div>
          );
        })}
      </section>
    </main>
  );
}
