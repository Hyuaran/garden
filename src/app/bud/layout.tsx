import type { ReactNode } from "react";
import { BudStateProvider } from "./_state/BudStateContext";
import { BudModuleGateWrapper } from "./_components/BudModuleGateWrapper";

export const metadata = {
  title: "Garden-Bud — 経理・収支",
};

/**
 * Bud ルートレイアウト。
 * BudStateProvider を最上位に配置する（login も dashboard も同じ Provider を共有）。
 *
 * Task 3: ModuleGate を /bud/login 除外の上で装着。既存 BudGate（個別 page で使用）
 * は二重防御として残置。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-7
 */
export default function BudLayout({ children }: { children: ReactNode }) {
  return (
    <BudStateProvider>
      <BudModuleGateWrapper>{children}</BudModuleGateWrapper>
    </BudStateProvider>
  );
}
