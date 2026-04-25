"use client";

/**
 * TreeAuthGate
 *
 * layout.tsx の中で TreeShell/children をラップし、以下を実施：
 * - 認証確認中：ローディング表示
 * - 未認証：/tree/login へリダイレクト
 * - 認証済：子コンポーネントを表示
 *
 * /tree/login は認証チェック対象外（無限ループ防止）。
 *
 * 設計:
 *   Forest の ForestGate と同じパターン。TreeStateContext の
 *   isAuthenticated / loading を監視し、useEffect で遷移する。
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { C } from "../_constants/colors";
import { TREE_PATHS } from "../_constants/screens";
import { useTreeState } from "../_state/TreeStateContext";

export function TreeAuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, treeUser } = useTreeState();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === TREE_PATHS.LOGIN;
  const isBirthdayPage = pathname === TREE_PATHS.BIRTHDAY;
  const needsBirthday = !!treeUser && treeUser.birthday === null;

  useEffect(() => {
    if (loading) return;
    // 未認証 → ログイン画面へ
    if (!isAuthenticated && !isLoginPage) {
      router.replace(TREE_PATHS.LOGIN);
      return;
    }
    // 認証済だが誕生日未登録 → 誕生日入力画面へ
    if (isAuthenticated && needsBirthday && !isBirthdayPage) {
      router.replace(TREE_PATHS.BIRTHDAY);
    }
  }, [loading, isAuthenticated, isLoginPage, isBirthdayPage, needsBirthday, router]);

  // ログイン画面は認証状態に関係なく表示
  if (isLoginPage) return <>{children}</>;

  // 認証確認中：ローディング
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Noto Sans JP', sans-serif",
          color: C.darkGreen,
          fontSize: 14,
          background: `linear-gradient(160deg, ${C.bgWarm1} 0%, ${C.bgWarm2} 50%, ${C.bgWarm3} 100%)`,
        }}
      >
        認証確認中...
      </div>
    );
  }

  // 未認証（useEffect のリダイレクト待機中）
  if (!isAuthenticated) return null;

  // 認証済
  return <>{children}</>;
}
