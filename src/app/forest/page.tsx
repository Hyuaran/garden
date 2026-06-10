"use client";

/**
 * /forest ルートページ → /forest/dashboard へ送るだけ。
 *
 * 認証/権限の関所は layout の ForestGate(ModuleGate) が担う（未認証は /login へ）。
 * ここで isUnlocked を見て /forest/login へ飛ばすと、セッション再開時に
 * ForestStateContext の非同期 refresh 完了前に発火してバウンスするため撤去。
 * 解錠状態の最終判定・表示は /forest/dashboard 側のガードに委ねる。
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ForestRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/forest/dashboard");
  }, [router]);

  return null;
}
