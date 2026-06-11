"use client";

import Link from "next/link";

import { MOBILE_MODULES } from "./_lib/mobile-modules";

export default function MobileHomePage() {
  return (
    <main style={page}>
      <header style={header}>
        <div style={brand}>Garden</div>
        <div style={sub}>必要な場所へ、すぐに入る</div>
      </header>

      <section aria-label="Garden 12モジュール" style={grid}>
        {MOBILE_MODULES.map((module) => {
          const tile = (
            <div style={tileStyle(module.ready, module.color)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/themes/module-icons/${module.key}.webp`}
                alt=""
                aria-hidden
                width={46}
                height={46}
                style={{ objectFit: "contain", filter: module.ready ? "none" : "grayscale(0.65)" }}
              />
              <div style={tileText}>
                <div style={moduleLabel(module.ready)}>{module.label}</div>
                <div style={description}>
                  {module.descriptionLines.map((line) => (
                    <span key={line} style={{ display: "block" }}>
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );

          if (module.ready) {
            return (
              <Link key={module.key} href={module.href} data-module-key={module.key} style={link}>
                {tile}
              </Link>
            );
          }

          return (
            <div key={module.key} data-module-key={module.key} aria-disabled="true" title={`${module.label} - モバイル準備中`}>
              {tile}
            </div>
          );
        })}
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100dvh",
  background: "linear-gradient(180deg, #f7f4ec 0%, #eef1e8 100%)",
  padding: "24px 16px 18px",
  maxWidth: 560,
  margin: "0 auto",
};
const header: React.CSSProperties = { textAlign: "center", marginBottom: 22 };
const brand: React.CSSProperties = {
  fontFamily: "'EB Garamond', serif",
  fontSize: 23,
  color: "#3d3528",
  letterSpacing: "0.04em",
};
const sub: React.CSSProperties = { fontSize: 12, color: "#7b745f", marginTop: 4 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 };
const link: React.CSSProperties = { textDecoration: "none", display: "block" };
const tileStyle = (ready: boolean, color: string): React.CSSProperties => ({
  height: 112,
  minHeight: 112,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  padding: 9,
  borderRadius: 16,
  background: "rgba(255,255,255,0.92)",
  border: ready ? `2px solid ${color}` : "2px solid #d8d4c8",
  boxShadow: "0 3px 10px rgba(0,0,0,0.05)",
  opacity: ready ? 1 : 0.55,
});
const tileText: React.CSSProperties = { textAlign: "center", width: "100%" };
const moduleLabel = (ready: boolean): React.CSSProperties => ({
  fontSize: 13,
  lineHeight: 1.15,
  fontWeight: 700,
  color: ready ? "#2b2b2b" : "#8a8475",
});
const description: React.CSSProperties = { fontSize: 9, lineHeight: 1.35, color: "#6f7864", marginTop: 3 };
