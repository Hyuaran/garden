import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "統合 KPI — Garden Bloom",
  description: "Tree / Leaf / Bud / Forest 4 モジュールの KPI を横断表示する統合ダッシュボード",
};

export default function BloomKpiLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
