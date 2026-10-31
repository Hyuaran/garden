"use client";

import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import Link from "next/link";
import { ModuleIcon } from "@/app/_components/ModuleIcon/ModuleIcon";

import { MOBILE_MODULES } from "./_lib/mobile-modules";

export default function MobileHomePage() {
  return (
    <main style={page}>
      <header style={header}>
        <div className="garden-help-heading"><h1 style={brand}>ホーム</h1><HelpButton /></div>
        <div style={sub}>必要な場所へ、すぐに入る</div>
      </header><SystemTabs />

      <Link href="/m/nhk" style={nhkLink}>NHK訪問業務 報告</Link>
      <Link href="/p/toss/board" style={tossLink}>トスアップ一覧を見る</Link>

      <section aria-label="Garden 12モジュール" style={grid}>
        {MOBILE_MODULES.map((module) => {
          const tile = (
            <div style={tileStyle(module.ready, module.color)}>
              <span style={{ width: 46, height: 46, filter: module.ready ? "none" : "grayscale(0.65)" }}><ModuleIcon id={module.key} /></span>
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
  background: "var(--m-bg)",
  padding: "24px 16px 18px",
  maxWidth: 560,
  margin: "0 auto",
};
const header: React.CSSProperties = { textAlign: "center", marginBottom: 22 };
const brand: React.CSSProperties = {
  fontFamily: "var(--m-font)",
  fontSize: 23,
  color: "var(--m-ink)",
  letterSpacing: "0.04em",
};
const sub: React.CSSProperties = { fontSize: 12, color: "var(--m-sub)", marginTop: 4 };
const nhkLink: React.CSSProperties = { display: "block", margin: "0 0 10px", padding: "14px", borderRadius: 12, background: "var(--m-card)", border: "2px solid #0ea5a0", color: "var(--m-accent)", textAlign: "center", textDecoration: "none", fontSize: 15, fontWeight: 800 };
const tossLink: React.CSSProperties = { display: "block", margin: "0 0 14px", padding: "12px 14px", borderRadius: 12, background: "var(--m-card)", border: "1px solid var(--m-line)", color: "var(--m-accent)", textAlign: "center", textDecoration: "none", fontSize: 13, fontWeight: 700 };
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
  background: "var(--m-card)",
  border: ready ? `2px solid ${color}` : "2px solid var(--m-line)",
  boxShadow: "0 3px 10px rgba(0,0,0,0.05)",
  opacity: ready ? 1 : 0.55,
});
const tileText: React.CSSProperties = { textAlign: "center", width: "100%" };
const moduleLabel = (ready: boolean): React.CSSProperties => ({
  fontSize: 13,
  lineHeight: 1.15,
  fontWeight: 700,
  color: ready ? "var(--m-ink)" : "var(--m-sub)",
});
const description: React.CSSProperties = { fontSize: 9, lineHeight: 1.35, color: "var(--m-sub)", marginTop: 3 };
