"use client";

/**
 * Root 認証ゲート — ModuleGate ラッパー (2026-05-11、Task 3)
 *
 * 旧 RootGate (RootStateContext の isAuthenticated/loading を直接監視) は
 * RootGate.legacy-20260511.tsx に保管。
 *
 * 動作:
 *   - /root/login: 認証チェック対象外（無限ループ防止）
 *   - 上記以外: ModuleGate で認証 + minRole=manager 判定
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-7
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ModuleGate } from "../../_components/ModuleGate";
import { AuthLoadingScreen } from "../../_components/AuthLoadingScreen";
import { useRootState } from "../_state/RootStateContext";

function RootLocalGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading, isAuthenticated } = useRootState();

  if (loading) {
    return <AuthLoadingScreen module="root" message="利用状況を確認しています..." />;
  }
  if (!isAuthenticated) {
    const href = `/root/login?returnTo=${encodeURIComponent(pathname)}&reason=expired`;
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f8fafc",
          padding: 24,
        }}
      >
        <section
          style={{
            width: "min(420px, 100%)",
            padding: 32,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            textAlign: "center",
          }}
        >
          <div aria-hidden="true" style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, color: "#1f2937" }}>
            もう一度ログインしてください
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.7, color: "#64748b" }}>
            Root の利用を続けるには、本人確認が必要です。
          </p>
          <Link
            href={href}
            style={{
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: 8,
              background: "#3e3e3e",
              color: "#fff",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ログイン画面へ
          </Link>
        </section>
      </main>
    );
  }
  return <>{children}</>;
}

export function RootGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/root/login";

  if (isLoginPage) return <>{children}</>;

  return (
    <ModuleGate module="root" loginPath="/root/login">
      <RootLocalGate>{children}</RootLocalGate>
    </ModuleGate>
  );
}
