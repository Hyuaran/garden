"use client";

/**
 * Forest ログインページ (/forest/login)
 *
 * 状態に応じて表示を切り替える:
 *  1. loading → スピナー
 *  2. ゲート通過済み → returnTo or /forest/dashboard にリダイレクト
 *  3. 未認証 or ゲート未通過 → ForestGate（ログインフォーム）
 *
 * returnTo パラメータ（2026-04-26 a-bloom 修正）:
 *   ?returnTo=/bloom などで指定されたら、ログイン後にそこへ遷移。
 *   未指定なら /forest/dashboard。Bloom などの他モジュールとの自然な行き来を実現。
 *
 * セキュリティ:
 *   外部 URL への redirect 防止のため、returnTo は **同じオリジンの path のみ** 受理。
 *   それ以外は /forest/dashboard にフォールバック。
 *
 * AccessDenied は「認証成功したが forest_users に登録されていない」
 * 特殊ケース向け。signInForest が権限なしを検出した時点で signOut されるため、
 * 通常はこのページでは表示されない（エラーメッセージで代替）。
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { ForestGate } from "../_components/ForestGate";
import { FOREST_THEME } from "../_constants/theme";
import { useForestState } from "../_state/ForestStateContext";

const DEFAULT_REDIRECT = "/forest/dashboard";

/**
 * returnTo の安全性検証。
 * 同じオリジン内の path（`/`から始まる）のみ許可、絶対 URL や `//host/...` は拒否。
 */
export function sanitizeForestReturnTo(raw: string | null): string {
  if (!raw) return DEFAULT_REDIRECT;
  // 絶対 URL（http:// 等）は拒否
  if (/^[a-z]+:\/\//i.test(raw) || raw.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }
  if (!raw.startsWith("/")) {
    return DEFAULT_REDIRECT;
  }
  return raw;
}

export default function ForestLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, isUnlocked } = useForestState();

  const returnTo = useMemo(
    () => sanitizeForestReturnTo(searchParams?.get("returnTo") ?? null),
    [searchParams],
  );

  useEffect(() => {
    if (!loading && isUnlocked) {
      router.replace(returnTo);
    }
  }, [loading, isUnlocked, returnTo, router]);

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
