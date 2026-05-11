"use client";

/**
 * Garden Series 共通モジュールゲート (2026-05-11、Task 3)
 *
 * Garden 12 モジュールの entry コンポーネントを統一する共通ゲート。
 * 各モジュール固有 Gate (ForestGate / BloomGate / TreeAuthGate) は本コンポーネントの
 * 薄いラッパーとして実装される。
 *
 * 動作:
 *   - 認証確認中  : AuthLoadingScreen（モジュール別絵文字スピナー）
 *   - 未認証      : loginPath?returnToParam=<currentURL> へリダイレクト
 *   - role 不足   : /access-denied?module=<module> へリダイレクト
 *   - 認証 + role OK : children をそのまま描画
 *
 * minRole はハードコード禁止のため `module-min-roles.ts` から取得。
 * 個別に上書きしたい場合は props.minRole で指定可能。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-1
 */

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuthUnified } from "../_lib/auth-unified";
import { isRoleAtLeast, type GardenRole } from "../root/_constants/types";
import { AuthLoadingScreen } from "./AuthLoadingScreen";
import {
  MODULE_MIN_ROLES,
  type GardenModule,
} from "../_constants/module-min-roles";

type ModuleGateProps = {
  children: ReactNode;
  module: GardenModule;
  /** 明示指定すれば MODULE_MIN_ROLES を上書き。通常は省略（一元管理） */
  minRole?: GardenRole;
  /** 未認証時の redirect 先。デフォルト `/login` */
  loginPath?: string;
  /** 未認証時の URL クエリ名。デフォルト `returnTo` */
  returnToParam?: string;
  /** dev 環境で `NEXT_PUBLIC_AUTH_DEV_BYPASS=1` のとき認証をバイパス */
  allowDevBypass?: boolean;
};

export function ModuleGate({
  children,
  module,
  minRole,
  loginPath = "/login",
  returnToParam = "returnTo",
  allowDevBypass = true,
}: ModuleGateProps) {
  const router = useRouter();
  const { loading, isAuthenticated, role } = useAuthUnified();
  const effectiveMinRole: GardenRole = minRole ?? MODULE_MIN_ROLES[module];

  const isDevBypass =
    allowDevBypass &&
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === "1";

  const hasRequiredRole = !!role && isRoleAtLeast(role, effectiveMinRole);
  const allowed = isDevBypass || (isAuthenticated && hasRequiredRole);

  useEffect(() => {
    if (loading || allowed) return;
    if (!isAuthenticated) {
      const current =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";
      router.replace(
        `${loginPath}?${returnToParam}=${encodeURIComponent(current)}`,
      );
      return;
    }
    router.replace(`/access-denied?module=${module}`);
  }, [
    loading,
    allowed,
    isAuthenticated,
    hasRequiredRole,
    loginPath,
    returnToParam,
    module,
    router,
  ]);

  if (allowed) return <>{children}</>;
  if (loading)
    return <AuthLoadingScreen module={module} message="認証確認中..." />;
  return (
    <AuthLoadingScreen
      module={module}
      message="ログインページに移動しています..."
    />
  );
}
