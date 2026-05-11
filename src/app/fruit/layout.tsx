/**
 * Garden-Fruit モジュール共通レイアウト (2026-05-11、Task 3)
 *
 * /fruit 配下のすべてのページに ModuleGate (minRole=manager) を適用。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-7
 */

import type { ReactNode } from "react";

import { ModuleGate } from "../_components/ModuleGate";

export const metadata = {
  title: "Garden-Fruit — 法人情報",
};

export default function FruitLayout({ children }: { children: ReactNode }) {
  return <ModuleGate module="fruit">{children}</ModuleGate>;
}
