/**
 * Coming Soon ページ 共通 component（dispatch v7-E）
 *
 * 未実装モジュール（/seed, /soil, /sprout, /fruit, /rill, /calendar）の 404 解消用。
 * 5/5 後道さんデモで全 12 module click 時に何らかの画面到達を保証。
 *
 * 各モジュール page.tsx から呼び出し、props で表記切替。
 */

import Link from "next/link";

export type ComingSoonProps = {
  /** Garden 正式名（例: "Seed"）*/
  moduleName: string;
  /** 和名（例: "種"）*/
  nameJa: string;
  /** 役割説明（例: "新商材・新事業の拡張枠"）*/
  description: string;
  /** 実装フェーズ（例: "Phase B" / "Phase C"）*/
  phase: string;
};

export function ComingSoonPage({ moduleName, nameJa, description, phase }: ComingSoonProps) {
  return (
    <main
      data-testid="coming-soon-page"
      data-module-name={moduleName}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#FAF8F3",
        padding: 32,
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: "#047857",
          margin: "0 0 16px",
        }}
      >
        {moduleName}
        <span style={{ fontSize: 22, color: "#6B8E75", marginLeft: 12 }}>/ {nameJa}</span>
      </h1>
      <p style={{ fontSize: 16, color: "#6B8E75", margin: "0 0 8px", maxWidth: 480, lineHeight: 1.6 }}>
        {description}
      </p>
      <p style={{ fontSize: 14, color: "#B45309", margin: "0 0 32px" }}>
        {phase} で実装予定です
      </p>
      <Link
        href="/"
        style={{
          padding: "12px 28px",
          background: "#3B9B5C",
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          borderRadius: 999,
          textDecoration: "none",
          boxShadow: "0 2px 8px rgba(31, 92, 58, 0.25)",
          transition: "background 0.15s ease",
        }}
      >
        ホームへ戻る
      </Link>
    </main>
  );
}
