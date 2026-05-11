/**
 * Garden-Sprout モジュール共通レイアウト (2026-05-11、Task 3)
 *
 * /sprout 配下のすべてのページに ModuleGate (minRole=staff) を適用。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-7
 */

import type { ReactNode } from "react";

import { ModuleGate } from "../_components/ModuleGate";

export const metadata = {
  title: "Garden-Sprout — 採用",
};

export default function SproutLayout({ children }: { children: ReactNode }) {
  return <ModuleGate module="sprout">{children}</ModuleGate>;
}
