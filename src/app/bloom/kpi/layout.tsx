import type { ReactNode } from "react";

export const metadata = {
  title: "統合 KPI — Garden Bloom",
  description: "6 法人の業績と Garden 開発進捗を横断で見渡す統合 KPI ダッシュボード。",
};

export default function BloomKpiLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
