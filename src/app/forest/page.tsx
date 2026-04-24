"use client";

/**
 * /forest ルートページ
 *
 * ゲート通過済み → /forest/dashboard
 * それ以外 → /forest/login
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useForestState } from "./_state/ForestStateContext";

export default function ForestRootPage() {
  const router = useRouter();
  const { loading, isUnlocked } = useForestState();

  useEffect(() => {
    if (loading) return;
    router.replace(isUnlocked ? "/forest/dashboard" : "/forest/login");
  }, [loading, isUnlocked, router]);

  return null;
}
