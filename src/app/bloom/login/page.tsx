"use client";

/**
 * Bloom ログインページ (/bloom/login)
 *
 * 状態に応じて表示を切り替える:
 *  1. loading → スピナー
 *  2. 認証 + ロック解除済 → returnTo or /bloom にリダイレクト
 *  3. 未認証 or ゲート未通過 → BloomLoginForm（ログインフォーム）
 *
 * returnTo パラメータ:
 *   ?returnTo=/bloom/workboard などで指定された場合、ログイン後にそこへ遷移
 *   未指定なら BLOOM_PATHS.HOME (/bloom)
 *
 * セキュリティ:
 *   外部 URL への redirect 防止のため、returnTo は **path のみ受理** (/bloom prefix 必須)
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { BloomLoginForm } from "../_components/BloomLoginForm";
import { BLOOM_PATHS } from "../_constants/routes";
import { useBloomState } from "../_state/BloomStateContext";

/**
 * returnTo の安全性検証。
 * 同じオリジン内の /bloom/* または /bloom 限定で許可、それ以外は無視して既定値を返す。
 */
export function sanitizeReturnTo(raw: string | null): string {
  if (!raw) return BLOOM_PATHS.HOME;
  // 絶対 URL（http/https/// で始まる）は拒否
  if (/^[a-z]+:\/\//i.test(raw) || raw.startsWith("//")) {
    return BLOOM_PATHS.HOME;
  }
  if (!raw.startsWith("/")) {
    return BLOOM_PATHS.HOME;
  }
  // /bloom 配下のみ許可
  if (raw === "/bloom" || raw.startsWith("/bloom/") || raw.startsWith("/bloom?")) {
    return raw;
  }
  return BLOOM_PATHS.HOME;
}

export default function BloomLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, isAuthenticated, hasPermission, isUnlocked } = useBloomState();

  const returnTo = useMemo(
    () => sanitizeReturnTo(searchParams?.get("returnTo") ?? null),
    [searchParams],
  );

  const allowed = isAuthenticated && hasPermission && isUnlocked;

  useEffect(() => {
    if (!loading && allowed) {
      router.replace(returnTo);
    }
  }, [loading, allowed, returnTo, router]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #1b4332 0%, #40916c 100%)",
          color: "#fff",
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: 14,
        }}
      >
        読み込み中...
      </div>
    );
  }

  if (allowed) {
    // useEffect でリダイレクト中
    return null;
  }

  return <BloomLoginForm />;
}
