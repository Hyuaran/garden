/**
 * Garden Series ホーム画面 — Task 2 (Server Component 化、2026-05-11)
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 2 §Step 2-2
 *
 * 経緯:
 *   - v2.8a Step 5 では page.tsx は "use client" だったが、Task 2 で server component 化。
 *   - 旧 page.tsx は page.legacy-20260511.tsx として保管（memory feedback_no_delete_keep_legacy.md）。
 *   - client ロジックは _components/home/GardenHomeClient.tsx に行単位コピー（機能後退なし）。
 *
 * server 側責務:
 *   1. Supabase Auth セッション確認 → 未ログインなら /login へ
 *   2. root_employees から garden_role を取得
 *   3. isHomeForbidden(role) なら getPostLoginRedirect(role) へ強制 redirect
 *      （closer/toss → /tree、outsource → /leaf/kanden、直 URL 叩き保険）
 *   4. visibleModules を算出して GardenHomeClient に prop で渡す
 *
 * 後続 (Task 3) で各モジュール ModuleGate もこの role 取得経路を再利用予定。
 */

import { redirect } from "next/navigation";

import { createServerClient } from "./_lib/supabase/server";
import { getPostLoginRedirect } from "./_lib/auth-redirect";
import {
  getVisibleModules,
  isHomeForbidden,
} from "./_lib/module-visibility";
import GardenHomeClient from "./_components/home/GardenHomeClient";

export default async function GardenHomePage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: emp } = await supabase
    .from("root_employees")
    .select("garden_role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = emp?.garden_role ?? null;

  // closer / toss / outsource は /home に来てはならない。
  // getPostLoginRedirect でログイン後の正規 redirect 先に強制送信（直 URL 入力時の保険）。
  if (isHomeForbidden(role)) {
    redirect(getPostLoginRedirect(role));
  }

  const visibleModules = getVisibleModules(role);

  return (
    <GardenHomeClient role={role} visibleModules={visibleModules} />
  );
}
