/**
 * Garden-Rill モジュール共通レイアウト (2026-05-11、Task 3)
 *
 * /rill 配下のすべてのページに ModuleGate (minRole=admin) を適用。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-7
 */

import type { ReactNode } from "react";

import { ModuleGate } from "../_components/ModuleGate";

export const metadata = {
  title: "Garden-Rill — メッセージ",
};

export default function RillLayout({ children }: { children: ReactNode }) {
  return <ModuleGate module="rill">{children}</ModuleGate>;
}
