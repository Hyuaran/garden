"use client";

/**
 * Forest ログインページ (/forest/login)
 *
 * 状態に応じて表示を切り替える:
 *  1. loading → スピナー
 *  2. ゲート通過済み → dashboard にリダイレクト
 *  3. 未認証 or ゲート未通過 → ForestGate（ログインフォーム）
 *
 * AccessDenied は「認証成功したが forest_users に登録されていない」
 * 特殊ケース向け。signInForest が権限なしを検出した時点で signOut されるため、
 * 通常はこのページでは表示されない（エラーメッセージで代替）。
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ForestGate } from "../_components/ForestGate";
import { FOREST_THEME } from "../_constants/theme";
import { useForestState } from "../_state/ForestStateContext";

export default function ForestLoginPage() {
  const router = useRouter();
  const { loading, isUnlocked } = useForestState();

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

  if (isUnlocked) {
    return null; // useEffect でリダイレクト中
  }

  return <ForestGate />;
}
