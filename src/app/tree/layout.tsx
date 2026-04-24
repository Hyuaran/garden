/**
 * Garden-Tree モジュール共通レイアウト
 *
 * /tree 配下のすべてのページに適用される。
 *
 *  - TreeStateProvider … 権限・KPI・通知など全画面共通の状態（認証状態含む）
 *  - TreeAuthGate      … 未認証時に /tree/login へリダイレクト
 *  - TreeShell         … サイドバー + KPI ヘッダー + 本文の3段構え
 *
 *  注）layout.tsx 自体はサーバーコンポーネントのままにして、
 *      クライアント依存（usePathname 等）は TreeShell / TreeAuthGate に閉じ込めている。
 */

import type { ReactNode } from "react";

import { TreeAuthGate } from "./_components/TreeAuthGate";
import { TreeShell } from "./_components/TreeShell";
import { TreeStateProvider } from "./_state/TreeStateContext";

export default function TreeLayout({ children }: { children: ReactNode }) {
  return (
    <TreeStateProvider>
      <TreeAuthGate>
        <TreeShell>{children}</TreeShell>
      </TreeAuthGate>
    </TreeStateProvider>
  );
}
