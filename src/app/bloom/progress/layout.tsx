import type { ReactNode } from "react";

export const metadata = {
  title: "開発進捗 - Garden Bloom",
  description: "Garden 12モジュールの開発進捗、マイルストーン、法人サマリを確認する画面です。",
};

export default function ProgressLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
