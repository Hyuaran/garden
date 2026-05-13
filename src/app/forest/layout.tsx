/**
 * Garden-Forest モジュール共通レイアウト
 *
 * /forest 配下のすべてのページに適用される。
 * Tree と同パターン: Provider → Shell → children
 */

import type { ReactNode } from "react";

import { ForestGate } from "./_components/ForestGate";
import { ForestShell } from "./_components/ForestShell";
import { ForestStateProvider } from "./_state/ForestStateContext";

export default function ForestLayout({ children }: { children: ReactNode }) {
  // Task 3: ForestGate を ModuleGate ラッパー化したため layout に装着。
  // 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-7
  return (
    <ForestStateProvider>
      <ForestGate>
        <ForestShell>{children}</ForestShell>
      </ForestGate>
    </ForestStateProvider>
  );
}
