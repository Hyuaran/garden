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

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ModuleGate } from "../../_components/ModuleGate";

export function RootGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/root/login";

  if (isLoginPage) return <>{children}</>;

  return (
    <ModuleGate module="root" loginPath="/root/login">
      {children}
    </ModuleGate>
  );
}
