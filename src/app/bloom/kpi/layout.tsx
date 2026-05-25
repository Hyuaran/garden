import type { ReactNode } from "react";

export const metadata = {
  title: "統合 KPI - Garden Bloom",
  description: "法人横断の売上、利益、業務 KPI、Garden 開発進捗を確認する統合ダッシュボードです。",
};

export default function KpiLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
