/**
 * Garden-Tree モジュール共通レイアウト
 *
 * /tree 配下のすべてのページに適用される。
 *
 *  - TreeStateProvider … 権限・KPI・通知など全画面共通の状態
 *  - TreeShell         … サイドバー + KPI ヘッダー + 本文の3段構え
 *
 *  注）layout.tsx 自体はサーバーコンポーネントのままにして、
 *      クライアント依存（usePathname 等）は TreeShell に閉じ込めている。
 */

import type { ReactNode } from "react";

import { TreeShell } from "./_components/TreeShell";
import { TreeStateProvider } from "./_state/TreeStateContext";

export default function TreeLayout({ children }: { children: ReactNode }) {
  return (
    <TreeStateProvider>
      <TreeShell>{children}</TreeShell>
    </TreeStateProvider>
  );
}
