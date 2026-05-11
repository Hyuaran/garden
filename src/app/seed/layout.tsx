/**
 * Garden-Seed モジュール共通レイアウト (2026-05-11、Task 3)
 *
 * /seed 配下のすべてのページに ModuleGate (minRole=staff) を適用。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-7
 */

import type { ReactNode } from "react";

import { ModuleGate } from "../_components/ModuleGate";

export const metadata = {
  title: "Garden-Seed — 新事業",
};

export default function SeedLayout({ children }: { children: ReactNode }) {
  return <ModuleGate module="seed">{children}</ModuleGate>;
}
