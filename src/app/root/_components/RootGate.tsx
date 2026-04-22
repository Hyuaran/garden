"use client";

/**
 * RootGate
 *
 * layout.tsx の中で RootShell/children をラップ。
 * - 認証確認中: ローディング表示
 * - 未認証 & /root/login 以外: saveReturnTo で URL 保持 → /root/login へ
 * - /root/login: そのまま表示 (ログイン画面は認証チェック対象外)
 * - 認証済: 子を表示
 *
 * パターン: Tree の TreeAuthGate を踏襲。
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { colors } from "../_constants/colors";
import { saveReturnTo } from "../_lib/auth";
import { useRootState } from "../_state/RootStateContext";

export function RootGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useRootState();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/root/login";

  useEffect(() => {
    if (!loading && !isAuthenticated && !isLoginPage) {
      if (pathname) saveReturnTo(pathname);
      router.replace("/root/login");
    }
  }, [loading, isAuthenticated, isLoginPage, pathname, router]);

  if (isLoginPage) return <>{children}</>;

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.bg,
          color: colors.textMuted,
          fontSize: 14,
        }}
      >
        認証確認中...
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
