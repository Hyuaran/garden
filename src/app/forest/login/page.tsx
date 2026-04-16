"use client";

/**
 * Forest ログインページ (/forest/login)
 *
 * 状態に応じて3パターンの表示を切り替える:
 *  1. loading → スピナー
 *  2. 未認証 or 権限なし → AccessDenied
 *  3. 権限あり＋ゲート未通過 → ForestGate
 *  4. 権限あり＋ゲート通過済み → dashboard にリダイレクト
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AccessDenied } from "../_components/AccessDenied";
import { ForestGate } from "../_components/ForestGate";
import { C } from "../_constants/colors";
import { FOREST_THEME } from "../_constants/theme";
import { useForestState } from "../_state/ForestStateContext";

export default function ForestLoginPage() {
  const router = useRouter();
  const { loading, isAuthenticated, hasPermission, isUnlocked } = useForestState();

  useEffect(() => {
    if (!loading && isUnlocked) {
      router.replace("/forest/dashboard");
    }
  }, [loading, isUnlocked, router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: FOREST_THEME.loginBackground,
          color: "#fff",
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: 14,
        }}
      >
        読み込み中...
      </div>
    );
  }

  if (!isAuthenticated || !hasPermission) {
    return <AccessDenied />;
  }

  if (isUnlocked) {
    return null; // useEffect でリダイレクト中
  }

  return <ForestGate />;
}
