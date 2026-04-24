/**
 * Garden-Forest モジュール共通レイアウト
 *
 * /forest 配下のすべてのページに適用される。
 * Tree と同パターン: Provider → Shell → children
 */

import type { ReactNode } from "react";

import { ForestShell } from "./_components/ForestShell";
import { ForestStateProvider } from "./_state/ForestStateContext";

export default function ForestLayout({ children }: { children: ReactNode }) {
  return (
    <ForestStateProvider>
      <ForestShell>{children}</ForestShell>
    </ForestStateProvider>
  );
}
