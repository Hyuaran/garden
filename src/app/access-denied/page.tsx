"use client";

/**
 * Garden 共通 アクセス拒否ページ (2026-05-11、Task 3)
 *
 * ModuleGate.tsx が role 不足を検知した際の redirect 先。
 * URL クエリ ?module= を元に日本語ラベルを表示し、ユーザーに権限不足を案内する。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-8
 */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const MODULE_LABEL: Record<string, string> = {
  forest: "経営ダッシュボード (Forest)",
  bud: "経理 (Bud)",
  root: "マスタ (Root)",
  tree: "架電 (Tree)",
  bloom: "業務管理 (Bloom)",
  soil: "DB 基盤 (Soil)",
  leaf: "商材 (Leaf)",
  seed: "新事業 (Seed)",
  rill: "メッセージ (Rill)",
  fruit: "法人情報 (Fruit)",
  sprout: "採用 (Sprout)",
  calendar: "暦 (Calendar)",
};

function AccessDeniedContent() {
  const params = useSearchParams();
  const moduleParam = params.get("module") ?? "";
  const label = MODULE_LABEL[moduleParam] ?? moduleParam;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "40px 32px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          maxWidth: 420,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          権限がありません
        </h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          {label} へのアクセス権限がアカウントに付与されていません。
          <br />
          管理者にお問い合わせください。
        </p>
        <Link href="/" style={{ color: "#16a34a", fontSize: 13 }}>
          Home へ戻る
        </Link>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={null}>
      <AccessDeniedContent />
    </Suspense>
  );
}
