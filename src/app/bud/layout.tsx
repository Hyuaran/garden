import type { ReactNode } from "react";
import { BudStateProvider } from "./_state/BudStateContext";

export const metadata = {
  title: "Garden-Bud — 経理・収支",
};

/**
 * Bud ルートレイアウト。
 * BudStateProvider を最上位に配置する（login も dashboard も同じ Provider を共有）。
 * BudGate / BudShell は各ページで個別にラップする
 * （login ページは Gate/Shell 不要のため）。
 */
export default function BudLayout({ children }: { children: ReactNode }) {
  return <BudStateProvider>{children}</BudStateProvider>;
}
