"use client";

/**
 * Bloom 認証ゲート — ModuleGate ラッパー (2026-05-11、Task 3)
 *
 * 旧 BloomGate (forest/login redirect + Bloom 独自 state チェック実装) は
 * BloomGate.legacy-20260511.tsx に保管。
 *
 * memory project_bloom_auth_independence.md: 当面は Forest login 経由（FOREST_LOGIN stub
 * → /login へ flow）。Bloom 独自ブランディングが必要になったら本ラッパーを差し替える。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-5
 */

import type { ReactNode } from "react";

import { ModuleGate } from "../../_components/ModuleGate";
import { BLOOM_PATHS } from "../_constants/routes";

export function BloomGate({ children }: { children: ReactNode }) {
  return (
    <ModuleGate module="bloom" loginPath={BLOOM_PATHS.FOREST_LOGIN}>
      {children}
    </ModuleGate>
  );
}
