import type { ReactNode } from "react";

import { BloomGate } from "./_components/BloomGate";
import { BloomLayoutClient } from "./_components/BloomLayoutClient";
import { BloomStateProvider } from "./_state/BloomStateContext";
import { ViewModeProvider } from "./_state/ViewModeContext";

export const metadata = {
  title: "Bloom — 花咲く業務の庭 | Garden",
  description: "Garden シリーズ 作業可視化 / ロードマップ / 月次ダイジェスト",
};

export default function BloomLayout({ children }: { children: ReactNode }) {
  // BloomLayoutClient で pathname により分岐:
  //   /bloom (Bloom Top) → BloomShell バイパス（v2.8a 統一デザインで直接 render）
  //   /bloom/* (workboard 等既存実装) → BloomShell で wrap（既存ロジック保護）
  return (
    <BloomStateProvider>
      <ViewModeProvider>
        <BloomGate>
          <BloomLayoutClient>{children}</BloomLayoutClient>
        </BloomGate>
      </ViewModeProvider>
    </BloomStateProvider>
  );
}
