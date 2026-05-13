"use client";

/**
 * Bud ModuleGate ラッパー (2026-05-11、Task 3)
 *
 * /bud/login は Task 1 で /login への redirect stub になっているが、
 * stub 動作中は ModuleGate を通したくない（無限ループ防止）。
 * pathname を確認して /bud/login のみ ModuleGate をスキップする。
 *
 * BudGate (既存) は各 page で個別に使われており、本ラッパーは追加レイヤー。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-7
 */

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ModuleGate } from "../../_components/ModuleGate";

export function BudModuleGateWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/bud/login";

  if (isLoginPage) return <>{children}</>;

  return (
    <ModuleGate module="bud" loginPath="/bud/login">
      {children}
    </ModuleGate>
  );
}
