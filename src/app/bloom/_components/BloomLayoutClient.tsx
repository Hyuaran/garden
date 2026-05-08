"use client";

/**
 * BloomLayoutClient — Bloom Top と他 Bloom 画面の layout 分岐
 *
 * 経緯:
 *   - 既存 /bloom/* は BloomShell で wrap（独自 header + nav + green gradient）
 *   - 5/5 デモ向け Bloom Top (v2.8a 統一デザイン) は BloomShell 不要
 *     → 既存 workboard / monthly-digest 等は BloomShell 維持（ロジック保護）
 *     → /bloom (Bloom Top のみ) は BloomShell をバイパス
 *   - dispatch v2.8a-bloom Step 1 (画面 1) の対応として導入
 *
 * dispatch main- No.58 (2026-05-05):
 *   タイトル個別化は各サブルートの layout.tsx で metadata.title export に切替
 *   （Next.js Metadata API 経由で SSR 時から有効）。
 *   No.56 で導入した useEffect + document.title は Metadata API と競合して
 *   navigation 後に上書きされる問題があったため撤去。
 *
 * 後段 (Phase 2 以降):
 *   - 全 Bloom 画面を v2.8a 統一デザイン化したら BloomShell 廃止 + 本コンポーネントも整理
 */

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BloomShell } from "./BloomShell";

export function BloomLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  // /bloom or /bloom/ のみ Bloom Top → BloomShell バイパス
  const isBloomTop = pathname === "/bloom" || pathname === "/bloom/";

  if (isBloomTop) {
    return <>{children}</>;
  }
  return <BloomShell>{children}</BloomShell>;
}
