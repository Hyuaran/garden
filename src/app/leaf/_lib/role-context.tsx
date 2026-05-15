"use client";

/**
 * Garden-Leaf 関電業務委託 — Garden Role の React Context
 *
 * spec: docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §3.4 / §1.5
 * plan v3 §Task D.12
 *
 * 用途:
 * - mount 時に `supabase.rpc('garden_role_of', { uid: auth.uid() })` で現在ロールを取得
 * - 全コンポーネントで `useGardenRole()` で取得可能（prop drill 不要）
 * - DeleteButton の表示判定（v3 では全員表示なので未使用）/ AdminActions の admin+ 判定で使用
 *
 * 配置:
 * - <RoleProvider> でルート（backoffice/page.tsx, input/page.tsx, root/me/...）を包む
 * - 子コンポーネントで `const role = useGardenRole();` で取得（ロード中は null）
 *
 * 設計方針:
 * - Context value は単純な `GardenRole | null`（ロード中 = null）
 * - ローディング状態を別 state にせず、null チェックで判定（シンプル化）
 * - SSR 環境では auth.getUser() が null を返すため、Provider は "use client" 必須
 */

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { GardenRole } from "./types";

const RoleContext = createContext<GardenRole | null>(null);

export type RoleProviderProps = {
  children: ReactNode;
};

/**
 * Garden Role を context に提供する Provider。
 * mount 時に Supabase auth + RPC で現在ロールを取得し、子コンポーネントへ伝播。
 */
export function RoleProvider({ children }: RoleProviderProps) {
  const [role, setRole] = useState<GardenRole | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getUser()).data.user;
      if (!user || !active) return;
      const { data, error } = await supabase.rpc("garden_role_of", {
        uid: user.id,
      });
      if (!active || error) return;
      setRole(data as GardenRole);
    })();
    return () => {
      active = false;
    };
  }, []);

  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/**
 * 現在ロールを取得するフック。
 *
 * - ロード中: null
 * - 認証済み + RPC 取得済み: GardenRole 値
 *
 * 使用例:
 * ```tsx
 * import { useGardenRole } from '@/app/leaf/_lib/role-context';
 * import { isAdminRole } from '@/app/leaf/_lib/types';
 *
 * function AdminOnlyButton() {
 *   const role = useGardenRole();
 *   if (!isAdminRole(role)) return null;
 *   return <button>Admin Action</button>;
 * }
 * ```
 */
export function useGardenRole(): GardenRole | null {
  return useContext(RoleContext);
}
