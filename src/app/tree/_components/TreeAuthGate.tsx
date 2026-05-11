"use client";

/**
 * Tree 認証ゲート — ModuleGate + 誕生日 2 段判定ラッパー (2026-05-11、Task 3)
 *
 * 旧 TreeAuthGate (TreeStateContext の isAuthenticated/treeUser を直接監視) は
 * TreeAuthGate.legacy-20260511.tsx に保管。
 *
 * 動作:
 *   1. /tree/login: 認証チェック対象外（無限ループ防止）
 *   2. ModuleGate で認証 + minRole=toss 確認（全 garden_role が通過可能）
 *   3. 認証済かつ誕生日未登録 → /tree/birthday へ強制リダイレクト
 *   4. 上記以外 → children をそのまま描画
 *
 * NOTE: useEffect は早期 return の前に配置（React Rules of Hooks 遵守）。
 *       plan §Step 3-6 のコード例は順序が逆だが本実装では正しい順序に修正。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-6
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { ModuleGate } from "../../_components/ModuleGate";
import { TREE_PATHS } from "../_constants/screens";
import { useTreeState } from "../_state/TreeStateContext";

export function TreeAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { treeUser } = useTreeState();
  const isLoginPage = pathname === TREE_PATHS.LOGIN;
  const isBirthdayPage = pathname === TREE_PATHS.BIRTHDAY;
  const needsBirthday = !!treeUser && treeUser.birthday === null;

  // 認証済だが誕生日未登録 → 誕生日入力画面へ強制遷移
  useEffect(() => {
    if (!treeUser) return;
    if (isLoginPage) return;
    if (needsBirthday && !isBirthdayPage) {
      router.replace(TREE_PATHS.BIRTHDAY);
    }
  }, [treeUser, needsBirthday, isBirthdayPage, isLoginPage, router]);

  // ログイン画面は認証チェック対象外（無限ループ防止）
  if (isLoginPage) return <>{children}</>;

  return (
    <ModuleGate module="tree" loginPath={TREE_PATHS.LOGIN}>
      {needsBirthday && !isBirthdayPage ? null : children}
    </ModuleGate>
  );
}
