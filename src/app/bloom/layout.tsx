import type { ReactNode } from "react";

import { BloomGate } from "./_components/BloomGate";
import { BloomShell } from "./_components/BloomShell";
import { BloomStateProvider } from "./_state/BloomStateContext";
import { ViewModeProvider } from "./_state/ViewModeContext";

export const metadata = {
  title: "Garden Bloom — Workboard",
  description: "Garden シリーズ 作業可視化 / ロードマップ / 月次ダイジェスト",
};

export default function BloomLayout({ children }: { children: ReactNode }) {
  return (
    <BloomStateProvider>
      <ViewModeProvider>
        <BloomGate>
          <BloomShell>{children}</BloomShell>
        </BloomGate>
      </ViewModeProvider>
    </BloomStateProvider>
  );
}
