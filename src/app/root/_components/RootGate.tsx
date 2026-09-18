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
import rootStyles from "./root-shell.module.css";

function RootLocalGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading, isAuthenticated } = useRootState();

  if (loading) {
    return <AuthLoadingScreen module="root" message="利用状況を確認しています..." />;
  }
  if (!isAuthenticated) {
    const href = `/root/login?returnTo=${encodeURIComponent(pathname)}&reason=expired`;
    return (
      <main className={`${rootStyles.shell} ${rootStyles.loginMain}`}>
        <section className={rootStyles.loginCard}>
          <svg className={rootStyles.loginMark} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21v-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 13c0-3 2.2-5 5-5 0 3-2.2 5-5 5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 15c0-2.6-2-4.5-4.5-4.5 0 2.6 2 4.5 4.5 4.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 className={rootStyles.loginHeading}>
            もう一度ログインしてください
          </h1>
          <p className={rootStyles.loginText}>
            Root の利用を続けるには、本人確認が必要です。
          </p>
          <Link
            href={href}
            className={rootStyles.loginLink}
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
