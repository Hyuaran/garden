"use client";

/**
 * Forest 認証ゲート — ModuleGate ラッパー (2026-05-11、Task 3)
 *
 * IN-4 準拠: Task 1 で .legacy-20260511.tsx に rename 済のため本 Task では rename しない。
 * Task 1 で作成した redirect-only shell から ModuleGate ラッパーへ書き換え。
 *
 * 旧本格実装は ForestGate.legacy-20260511.tsx に保管。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-4
 */

import type { ReactNode } from "react";

import { ModuleGate } from "../../_components/ModuleGate";

export function ForestGate({ children }: { children?: ReactNode }) {
  // loginPath="/forest/login" stub 経由で /login?returnTo= に到達（ブックマーク互換）
  // children は optional（legacy file `forest/login/page.legacy-20260511.tsx` が
  // `<ForestGate />` 形式で呼ぶ後方互換のため）
  return (
    <ModuleGate module="forest" loginPath="/forest/login">
      {children}
    </ModuleGate>
  );
}
