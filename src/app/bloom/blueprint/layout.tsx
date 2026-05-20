import type { ReactNode } from "react";
import type { Viewport } from "next";

export const metadata = {
  title: "Garden 設計図 - Garden Bloom",
  description: "Garden Series の構造、モジュール、AI 役割、リソース対応をまとめた設計図です。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function BlueprintLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
